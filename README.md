
# Alexa Snow Emergency (alexa-snowmer)
## Test
You'll want to create the snowmer_places table for testing every time you re-start the local Docker container instance of the database.

    node artifacts/database/09152018_create_snowmer_places.js
then when you want to run tests

    npm test

## Package zip for upload to AWS Lambda

    npm run zpack

## Database
Using DynamoDB for logging requests. See https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html for more info.

A Docker version exists at https://hub.docker.com/r/amazon/dynamodb-local/, to start

    docker run -p 8001:8000 amazon/dynamodb-local

### populate database
You may need to change values in the following script to match the location of your database:

    node artifacts/database/09152018_create_snowmer_places.js


## AWS permissions
You may need to add a permission

    aws lambda add-permission --function-name <function_name> --action lambda:InvokeFunction  --statement-id <SID> --principal alexa-appkit.amazon.com --output text

# Resources
## Cities
https://www.minnesota-demographics.com/cities_by_population

http://minnesota.cbslocal.com/snow-emergency-information/#stlouispark

## AWS
https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Tools.CLI.html
https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html
