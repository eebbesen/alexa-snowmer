const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk');
const axios = require('axios')

if (process.env.NODE_ENV == 'test') {
  AWS.config.update({
    region: 'local',
    endpoint: 'http://localhost:8001'
  });
} else {
  AWS.config.update({region: 'us-east-1'});
}
var docClient = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});

const cityMappings = require("./artifacts/city_map.json");

const usStates = [
  'alabama',
  'alaska',
  'arizona',
  'arkansas',
  'california',
  'colorado',
  'connecticut',
  'delaware',
  'florida',
  'georgia',
  'hawaii',
  'idaho',
  'illinois',
  'indiana',
  'iowa',
  'kansas',
  'kentucky',
  'louisiana',
  'maine',
  'maryland',
  'massachusetts',
  'michigan',
  'minnesota',
  'mississippi',
  'missouri',
  'montana',
  'nebraska',
  'nevada',
  'new hampshire',
  'new jersey',
  'new mexico',
  'new york',
  'north carolina',
  'north dakota',
  'ohio',
  'oklahoma',
  'oregon',
  'pennsylvania',
  'rhode island',
  'south carolina',
  'south dakota',
  'tennessee',
  'texas',
  'utah',
  'vermont',
  'virginia',
  'washington',
  'west virginia',
  'wisconsin',
  'wyoming'
]

const slotWorker = function(intent) {
  let vals = { stateName: null, cityName: null }

  if (typeof intent == "undefined" || typeof intent.slots == "undefined"){
    return vals;
  }

  if (typeof intent.slots.stateName !== "undefined" && typeof intent.slots.stateName.value !== "undefined") {
    vals.stateName = intent.slots.stateName.value.toLowerCase();
  }

  if (typeof intent.slots.cityName !== "undefined" && typeof intent.slots.cityName.value !== "undefined") {
    vals.cityName = intent.slots.cityName.value.toLowerCase();
  }

  vals = cityExtractor(vals.cityName, vals.stateName);

  console.log('SNOWMONITOR:location ********', vals.cityName + ' ********');

  return vals;
}

// remove punctuation and whitespace from a location name
const formatLocation = function(loc) {
  return loc.replace(/\s/g, '').replace(/\W/g, '').toLowerCase();
}

const cityExtractor = function(cityName, stateName) {
  if (typeof stateName !== 'undefined' && null != stateName){
    for (var s in usStates) {
      if (stateName.endsWith(usStates[s])) {
        return {cityName: [cityName, stateName.split(usStates[s])[0]].join(" ").trim(), stateName: usStates[s]};
      }
    }
  }

  return {cityName: [cityName, stateName].join(' ').trim().toLowerCase(), stateName: null};
}

const logSelection = function(city, state) {
  const params = {
    TableName: 'snowmer_places',
    Item: {
      'city': city,
      'state': state,
      'date': new Date().toISOString()
    }
  };

  docClient.put(params, function(err, data) {
    if (err) {
      console.log("Error writing to databse for " + city + " " + state, err);
    } else {
      console.log("Successfully logged " + city + " " + state, data);
    }
  });
}

const getCityStatus = function(city, state) {
  logSelection(city, state);
  const payload = cityMappings[formatLocation(city)];
  if (typeof payload == 'undefined') {
    return new Promise((r) => {return r('unknown')});
  }

  if (payload.yesCondition.length == 0 && payload.noCondition.length == 0) {
    return new Promise((r) => {return r('maybe')});
  }

  return axios.get(payload.site)
    .then(resp => {
      for (let i = 0; i < payload.yesCondition.length; i++) {
        if (resp.data.toLowerCase().includes(payload.yesCondition[i].toLowerCase())) {
          return true;
        }
      }
      return false;
    });
}

// wraps non-amazon functionality
const statusWorker = function(cityName, intentCityName) {
  if (cityName) {
    return getCityStatus(formatLocation(cityName))
      .then(status => {
        if ('unknown' == status) {
          if (intentCityName && cityName == intentCityName.toLowerCase()) {
            return 'need_city';
          }
          return "I don't have information about " + cityName + ", but I'll add it to my list of cities to learn about.";
        } else if (status == true) {
          return "A snow emergency is currently in effect for " + cityName;
        } else if (status == 'maybe') {
          let resp = cityName + " doesn't post snow emergency status on their website so I can't tell if there is one currently.";
          resp += " " + cityName + "'s threshold for declaring a snow emergency is " + cityMappings[formatLocation(cityName)]['threshold'] + " inches.";
          return resp
        } else if (status == false) {
          return "There is not a snow emergency in " + cityName + " right now";
        } else {
          return "I had an issue getting information for " + cityName;
        }
      })
  } else {
    return new Promise((r) => {return r('need_city')});
  }
}

// from https://github.com/alexa/alexa-cookbook/blob/master/display-directive/bodyTemplate/index.js
function supportsDisplay() {
  const hasDisplay =
    this.event &&
    this.event.context &&
    this.event.context.System &&
    this.event.context.System.device &&
    this.event.context.System.device.supportedInterfaces &&
    this.event.context.System.device.supportedInterfaces.Display;

  return hasDisplay;
}

const launchLambdaServiceWrapper = function(text, handlerInput) {
  let w = 'For what city?';
  if (typeof text !== undefined && null != text){
    w = text + ". " + w;
  }

  return handlerInput.responseBuilder
      .speak(w)
      .reprompt('Which city?')
      .getResponse();
};

const lambdaServiceWrapper = function(handlerInput) {
  console.log('lambdaServiceWrapper.handlerInput.requestEnvelope');
  console.dir(handlerInput.requestEnvelope, {depth: null});
  const slots = slotWorker(handlerInput.requestEnvelope.request.intent);

  if ('error' == slots) {
    return handlerInput.responseBuilder
      .speak('I am sorry, I am having problems right now.')
      .getResponse();
  }

  return statusWorker(slots.cityName, handlerInput.requestEnvelope.request.intent.slots.cityName.value)
    .then(resp => {
      console.log('lambdaServiceWrapper.statusWorker.resp')
      console.dir(resp, { depth: null })
      if ('need_city' == resp) {
        return launchLambdaServiceWrapper(null, handlerInput);
      } else {
        const payload = cityMappings[formatLocation(slots.cityName)];
        return handlerInput.responseBuilder
          .speak(resp)
          // .withSimpleCard('Snow Emergency', payload)
          .getResponse();
      }
    });
};

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    console.log('LaunchrequestEnvelope.handlerInput');
    console.dir(handlerInput, {depth: null});
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    return LambdaServiceWrapper(handlerInput)
  }
};

const LocationRequestHandler = {
  canHandle(handlerInput) {
    console.log('LocationrequestEnvelope.handlerInput');
    console.dir(handlerInput, {depth: null});
    return handlerInput.requestEnvelope.request.type === 'IntentRequest';
  },
  handle(handlerInput) {
    return lambdaServiceWrapper(handlerInput)
  }
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
    return handlerInput.responseBuilder.getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak('Sorry, I can\'t understand the command. Please say again.')
      .reprompt('Sorry, I can\'t understand the command. Please say again.')
      .getResponse();
  },
};

let skill;

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    LocationRequestHandler,
    SessionEndedRequestHandler)
  .addErrorHandlers(ErrorHandler)
  .lambda();

// for testing
exports.slotWorker = slotWorker;
exports.getCityStatus = getCityStatus;
exports.formatLocation = formatLocation;
exports.statusWorker = statusWorker;
exports.lambdaServiceWrapper = lambdaServiceWrapper;
exports.launchLambdaServiceWrapper = launchLambdaServiceWrapper;
exports.cityExtractor = cityExtractor;
