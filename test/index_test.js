process.env.NODE_ENV = 'test'

const chai = require('chai')
const should = chai.should()
const index = require('../index')
const Alexa = require('ask-sdk-core')
const axios = require('axios')
const sandbox = require('sinon').createSandbox();
const sinon = require('sinon');

const LOCATION = {
  "stateOrRegion": "MN",
  "city": "saintpaul",
  "countryCode": "US",
  "postalCode": "55105",
  "addressLine1": "1600 Grand Ave",
  "addressLine2": null,
  "addressLine3": null,
  "districtOrCounty": null
}

var handlerInput = null;
var responseBuilder = null;

describe('skill methods', function(){
  beforeEach(() => {
    responseBuilder = {
      speak: function(text) {
        console.log('SPEAK: ' + text);
        this.text = text
        return this;
      },
      reprompt: function(text) {
        console.log('SPEAK: ' + text);
        this.text = text
        return this;
      },
      listen: function() {
        console.log('LISTEN');
        return this;
      },
      renderTemplate: function(template) {
        console.log('RENDER TEMPLATE: ' + template);
        this.template = template;
        return this;
      },
      getResponse: function() {
        console.log('GET RESPONSE');
        return this;
      },
      withSimpleCard: function(name, text) {
        console.log('SIMPLE CARD: '+ name + ' ' + text);
        return this;
      }
    };

    index.requestEnvelope = {
      context: {
        System: {
          user: {
            permissions: {
              consentToken: 'c0nsentT0ken'
            },
            apiEndpoint: 'https://fake.aws.moc/api/v1',
            device: {
              deviceId: 'amzna8675309ona'
            }
          }
        }
      },
      request: {
        requestId: 77,
        intent: {
          slots: {
            cityName: {
              value: 'saint Paul'
            }
          }
        }
      }
    };

    handlerInput = {
      responseBuilder: responseBuilder,
      requestEnvelope: {
        context: {
          System: {
            user: {
              permissions: {
                consentToken: 'c0nsentT0ken'
              },
              apiEndpoint: 'https://fake.aws.moc/api/v1',
              device: {
                deviceId: 'amzna8675309ona'
              }
            }
          }
        },
        request: {
          requestId: 77,
          intent: {
            slots: {
              cityName: {
                value: 'saint Paul'
              }
            }
          }
        }
      }
    };
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('statusWorker', function() {
    it ('handles a non-city in the city slot', (done) => {
      index.statusWorker('about', 'about')
        .then(resp => {
          resp.should.equal('need_city')

          done()
        })
        .catch(err => {
          done(err)
        })
    })

    it ('handles a maybe city that notifies on website when there is an emergency', (done) => {
      index.statusWorker('brooklyn park')
        .then(resp => {
          resp.should.equal("brooklyn park doesn't post snow emergency status on their website so I can't tell if there is one currently. brooklyn park's threshold for declaring a snow emergency is 2 inches.")

          done()
        })
        .catch(err => {
          done(err)
        })
    })

    it ('handles a city that notifies on website when there is an emergency', (done) => {
      const data = 'blahblahblah Saint Paul declares snow emergency stuff'
      const resolved = new Promise((r) => r({ data }))
      const axiosStub = sandbox.stub(axios, 'get').returns(resolved)

      index.statusWorker('saint Paul')
        .then(resp => {
          resp.should.equal('A snow emergency is currently in effect for saint Paul')

          done()
        })
        .catch(err => {
          done(err)
        })
    })

    it ('handles a city that notifies on website when there is no emergency', (done) => {
      const data = 'blahblahblah there is currently no snow emergency in effect stuff'
      const resolved = new Promise((r) => r({ data }))
      const axiosStub = sandbox.stub(axios, 'get').returns(resolved)

      index.statusWorker('saint Paul')
        .then(resp => {
          resp.should.equal('There is not a snow emergency in saint Paul right now')

          done()
        })
        .catch(err => {
          done(err)
        })
    })

    it ('handles a city that does not notify on website', (done) => {
      index.statusWorker('Rochester')
        .then(resp => {
          resp.should.equal("Rochester doesn't post snow emergency status on their website so I can't tell if there is one currently. Rochester's threshold for declaring a snow emergency is 2 inches.")

          done()
        })
        .catch(err => {
          done(err)
        })
    })

    it ('handles a city that we do not track', (done) => {
      index.statusWorker('Cleveland')
        .then(resp => {
          resp.should.equal("I don't have information about Cleveland, but I'll add it to my list of cities to learn about.")

          done()
        })
        .catch(err => {
          done(err)
        })
    })

    it ('handles no city given', (done) => {
      index.statusWorker()
        .then(resp => {
          resp.should.equal("need_city")

          done()
        })
        .catch(err => {
          done(err)
        })
    })
  })

  describe ('cityExtractor', function() {
    it ('handles two-word cities', (done) => {
      const resp = index.cityExtractor('brooklyn', 'center')
      resp.cityName.should.equal('brooklyn center')

      done()
    })

    it ('handles two-word cities with state', (done) => {
      const resp = index.cityExtractor('brooklyn', 'center minnesota')

      resp.cityName.should.eql('brooklyn center')

      done()
    })

    it ('handles two-word cities with two-word state only first word flagged as city', (done) => {
      const resp = index.cityExtractor('sioux', 'falls south dakota')
      resp.cityName.should.eql('sioux falls')

      done()
    })

    it ('handles three-word cities with one-word state only first word flagged as city', (done) => {
      const resp = index.cityExtractor('theif', 'river falls wisconsin')
      resp.cityName.should.eql('theif river falls')

      done()
    })
  })

  describe('getCityStatus', function() {
    it ('returns unknown when it does not have the city', (done) => {
      index.getCityStatus('paintsaul')
        .then(resp => {
          resp.should.equal('unknown')

          done()
        })
        .catch(err => {
          done(err)
        })
    })

    it ('returns unknown when city has two words', (done) => {
      index.getCityStatus('brooklyn center')
        .then(resp => {
          resp.should.equal('unknown')

          done()
        })
        .catch(err => {
          done(err)
        })
    })

    it ('returns maybe when city does not post status', (done) => {
      index.getCityStatus('rochester')
        .then(resp => {
          resp.should.equal('maybe')

          done()
        })
        .catch(err => {
          done(err)
        })
    })

    describe('snow emergency in effect', () => {
      it ('returns true', (done) => {
        const data = 'blahblahblah Saint Paul declares Snow emergency stuff'
        const resolved = new Promise((r) => r({ data }))
        const axiosStub = sandbox.stub(axios, 'get').returns(resolved)

        index.getCityStatus('SaintPaul')
          .then((cityStatus) => {
            cityStatus.should.equal(true)

            done()
          })
          .catch(err => {
            done(err)
          })
      })
    })

    describe('no snow emergency declared verified', function() {
      beforeEach(() => {
        const data = 'There is currently no SNow emergency in effect blahblahblah'
        const resolved = new Promise((r) => r({ data }))
        const axiosStub = sandbox.stub(axios, 'get').returns(resolved)
      })

      it ('returns false', (done) => {
        index.getCityStatus('saintpaul')
          .then((cityStatus) => {
            cityStatus.should.equal(false)

            done()
          })
          .catch(err => {
            done(err)
          })
      })

      it ('is case insensitive', (done) => {
        index.getCityStatus('SAINtpaul')
          .then((cityStatus) => {
            cityStatus.should.equal(false)

            done()
          })
          .catch(err => {
            done(err)
          })
      })
    })
  })

  describe('slot worker', () => {
    it ('returns defaults with no intent', (done) => {
      const resp = index.slotWorker(undefined)

      resp.should.eql({ stateName: null, cityName: null })

      done()
    })

    it ('returns defaults with no intent slots', (done) => {
      const resp = index.slotWorker({fun_stuff: 'blah'})

      resp.should.eql({ stateName: null, cityName: null })

      done()
    })

    it ('returns hash with city slot', (done) => {
      const resp = index.slotWorker({slots: {cityName: {value:'saint Paul'}}})
      resp.should.eql({ stateName: null, cityName: 'saint paul' })

      done()
    })

    it ('returns hash with state and city slot', (done) => {
      const resp = index.slotWorker({slots: {cityName: {value:'saint Paul'}, stateName: {value: 'Minnesota'}}})

      resp.should.eql({ stateName: 'minnesota', cityName: 'saint paul' })

      done()
    })
  })

  describe('formatLocation', () => {
    it('strips whitespace', (done) => {
      const loc = index.formatLocation('saint Paul')

      loc.should.equal('saintpaul')

      done()
    })

    it('strips punctuation and whitespace', (done) => {
      const loc = index.formatLocation('St. Paul')

      loc.should.equal('stpaul')

      done()
    })
  })

  describe('launchLambdaServiceWrapper', () => {
    it ('works with text', (done) => {
      index.launchLambdaServiceWrapper('do some help', handlerInput);
      done()
    })

    it('works with null text', (done) => {
      index.launchLambdaServiceWrapper(null, handlerInput);

      done()
    })

    it('works with no text', (done) => {
      index.launchLambdaServiceWrapper('', handlerInput);

      done()
    })
  })

  describe('lambdaServiceWrapper', () => {
    it ('works', (done) => {

      index.lambdaServiceWrapper(handlerInput);

      done()
    })

    it ('binds to launchLambdaServiceWrapper', (done) => {
      handlerInput.requestEnvelope.request.intent.slots.cityName.value = 'about'

      index.lambdaServiceWrapper(handlerInput)
        .then(resp => {
          done()
        })
        .catch(err => {
          done(err)
        })
    })

    it ('handles city with policy', (done) => {
      handlerInput.requestEnvelope.request.intent.slots.cityName.value = 'eagan'

      index.lambdaServiceWrapper(handlerInput)
        .then(resp => {
          console.log('ababababa')
          console.dir(resp, { depth: null })
          console.log('ababababa')
          console.dir(index.response, { depth: null })
          resp.text.should.equal("eagan doesn't post snow emergency status on their website so I can't tell if there is one currently. eagan's threshold for declaring a snow emergency is 2 inches.");
          // resp.withSimpleCard().should.equal("The City of Eagan has an odd/even winter parking schedule in place from November 15 – April 15. On even days: Parking is ALLOWED on the side of the street with EVEN house addresses. On odd days: Parking is ALLOWED on the side of the street with ODD house addresses.")

          done()
        })
        .catch(err => {
          done(err)
        })
    })

    it ('handles two-word city with policy', (done) => {
      handlerInput.requestEnvelope.request.intent.slots.cityName.value = 'saint cloud'

      index.lambdaServiceWrapper(handlerInput)
        .then(resp => {
          resp.text.should.equal("saint cloud doesn't post snow emergency status on their website so I can't tell if there is one currently. saint cloud's threshold for declaring a snow emergency is 2 inches.");
          // resp.text.should.equal("Generally, with a normal snowfall of 2 inches or more, the City plows all streets, alleys, parking lots, and affected sidewalks in the system. A normal call-out occurs at midnight or 1 a.m.")

          done()
        })
        .catch(err => {
          done(err)
        })
    })

    it ('upper-cases city for display', (done) => {
      handlerInput.requestEnvelope.request.intent.slots.cityName.value = 'saint cloud'

      index.lambdaServiceWrapper(handlerInput)
        .then(resp => {
          // resp.template.title.should.equal('Saint Cloud policy')

          done()
        })
        .catch(err => {
          done(err)
        })
    })
  })

  // used for live testing against websites, skipped for testing
  describe('live test', function() {
    it.skip ('returns data from the internet', (done) => {
      index.getCityStatus('minneapolis')
        .then( cityStatus => {

          cityStatus.should.equal(false)

          done()
        })
      })
  })

})
