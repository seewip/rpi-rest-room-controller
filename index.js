// API key used to access the REST interface
var API_KEY = "secret";

var path = require('path');
// Path to a file containing a full MongoDB URI
var mongodbConfigurationFile = path.join(__dirname, '/mongodb.conf');

var moment = require("moment");
var express = require("express");
var bodyParser = require("body-parser");
var helmet = require("helmet");
var fs = require("fs");

var publicFolder = path.join(__dirname, '/public');
var MongoClient = require('mongodb').MongoClient;
var port = (process.env.PORT || 10000);

var app = express();
app.use(bodyParser.json());
app.use(helmet());

var mdbURL;
var db;

// Helper method to check for apikey
var checkApiKeyFunction = function(request, response) {
    if (!request.query.apikey) {
        console.error('WARNING: No apikey was sent!');
        response.sendStatus(401);
        return false;
    }
    if (request.query.apikey !== API_KEY) {
        console.error('WARNING: Incorrect apikey was used!');
        response.sendStatus(403);
        return false;
    }
    return true;
};

// Read MongoDB URI from file

try {
    mdbURL = fs.readFileSync(mongodbConfigurationFile).toString('utf-8').replace(/(\r\n|\n|\r)/gm,"");
} catch (err) {
    console.log("File containing MongoDB URI could not be found. The application will now exit. File location: " + mongodbConfigurationFile);
    console.log(err);
    process.exit(1);
}

console.log("Loaded file with MongoDB URI, connecting now...");

MongoClient.connect(mdbURL, {
    native_parser: true
}, function(err, database) {

    if (err) {
        console.log("CAN NOT CONNECT TO DB: " + err);
        throw err;
    }

    db = database.collection("temperature_humidity");

    // Run temperature and humidity data gathering
    setInterval(() => {
        var exec = require('child_process').spawnSync;
        var process = exec('/home/pi/nodetemp.sh');
        var input = process.stdout.toString().split(",");
        if (input.length != 2) {
            console.log("Malformed information about temperature/humidity, skipping - " + process.stdout.toString());
        } else {
            var obj = {time: moment().format('HH:mm:ss'), date: moment().format('DD.MM.YYYY'), timestamp: moment().unix(), temperature: Number(input[0]), humidity: Number(input[1])};
            db.insert(obj);
        }
    }, 60 * 1000);

    app.listen(port, () => {
        console.log("Database connected successfully. Web server is listening on port " + port);
    });

});

app.use("/", express.static(publicFolder));

//-------------------------------------------------------------------//

var BASE_API_PATH = "/api/v1";

// TODO GET ALL Lights status

// TODO GET SINGLE Light status

// SET SINGLE Light status
app.put(BASE_API_PATH + "/lights/:number", function(request, response) {
    console.log("INFO: New GET request to /lights/:number");
    if (!checkApiKeyFunction(request, response)) return;
    var numberParam = request.params.number;
    var exec = require('child_process').exec;
    var success = true;
    switch (numberParam) {
        case "1":
            exec('/home/pi/lightA.sh');
            break;
        case "2":
            exec('/home/pi/lightB.sh');
            break;
        case "3":
            exec('/home/pi/lightC.sh');
            break;
        case "4":
            exec('/home/pi/lightD.sh');
            break;
        default:
            console.log("WARNING: Incorrect light number was received!");
            success = false;
    }
    if(success) response.sendStatus(200);
    else response.sendStatus(400);
});

// GET Temperature and Humidity readings (climate)

app.get(BASE_API_PATH + "/climate", function(request, response) {
    console.log("INFO: New GET request to /climate");
    if (!checkApiKeyFunction(request, response)) {
        return;
    }
    var limit = 120;
    if(!isNaN(request.query.limit)) limit = Number(request.query.limit);
    db.find({}).sort({_id:1}).limit(limit).toArray(function(err, data) {
        if (err) {
            console.error('WARNING: Error getting data from DB');
            response.sendStatus(500); // internal server error
        }
        else {
            response.send(data);
        }
    });
});