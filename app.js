const express = require("express");
const bodyParser = require("body-parser");
const _ = require("lodash");
const mongoose = require("mongoose");
const https = require("https");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const request = require("request");

let zip = "00000"

// create app
const app = express();

// set up body parser
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.static("public"));

// set the app view engine to ejs, this enables templates
app.set("view engine", "ejs");


mongoose.connect(*DatabaseURI*, {
  useNewUrlParser: true
});

const actionSchema = {
  name: String,
  desc: String,
  level: [String],
  org: String,
  cityCounty: String,
  state: String,
  header: String,
  body: String,
  zips: [String],
  imgLoc : String,
  date_added : Date,
  tagname: String

}

const Action = mongoose.model("action", actionSchema);




app.get("/", function(req, res) {
  res.render("home");
});

app.get("/local", function(req, res) {
  Action.find({zips : zip}, function(err, actions){
    res.render("local", {
      zipcode : zip,
      actionItems : actions
    });
  });


});

app.post("/zip", function(req, res){
  zip = req.body.zip;
  res.redirect("/local")
});

app.get("/add", function(req, res){
  res.render("add");
});

var upload = multer({
  dest: "public/coverimgs"
});

app.post("/addAction", upload.single('cover'), function(req, res){
  const city = req.body.cityCounty;
  const state = req.body.state;
  const title = req.body.name;
  let tagname = "EC" + title + city + state;
  tagname = tagname.replace(new RegExp(" ", "g"), "");
  const level = req.body.levels;
  const org = req.body.orgName;
  const description = req.body.desc;
  const emailHeader = req.body.header;
  const emailBody = req.body.body;
  const cover = req.file;
  const tempPath = cover.path;
  var imgName = title.replace(new RegExp(" ", "g"), "_");
  imgName = imgName.concat('.jpg');
  const targetPath = path.join(__dirname, '/public/coverimgs/', imgName);
  localImgLoc = 'coverimgs/'.concat(imgName);

  if (path.extname(req.file.originalname).toLowerCase() === ".jpg") {
      fs.rename(tempPath, targetPath, err => {
        if (err) return handleError(err, res);


          console.log("File uploaded!");
      });
    } else {
      fs.unlink(tempPath, err => {
        if (err) return handleError(err, res);

        console.log("Only .jpg files are allowed!");
      });
    };

    const today = new Date();

    zipURL = "https://www.zipcodeapi.com/rest/*APIKEY*/city-zips.json/";
    zipRequest = zipURL.concat(city, '/', state);


    request(zipRequest, function(error, response, body) {
      var zipCodes = JSON.parse(body).zip_codes;

      const action = new Action({
        name: title,
        level: level,
        org : org,
        desc: description,
        cityCounty: city,
        tagname : tagname,
        state: state,
        header: emailHeader,
        body: emailBody,
        zips: zipCodes,
        imgLoc : localImgLoc,
        date_added : today
      });

      action.save();


    });

  res.redirect('/add');
});

app.post('/view', function(req, res){
  actionName = req.body.action;
  zipcode = req.body.zip;
  Action.findOne({name : actionName}, function(err, action){
    res.render('action', {
      officialsNames : ['Name'],
      emails : [],
      org : action.org,
      zipcode : zipcode,
      officialsTitles : ['Title'],
      actionTitle : action.name,
      actionHeader : action.header,
      actionBody : action.body,
      actionDescription : action.desc,
      actionState : action.state,
      usersName: "",
      usersAddress: "",
      inputName: "[NAME]",
      tagname : action.tagname

    })
  });
});



app.post('/email', function(req, res){
  actionName = req.body.action;
});


app.post('/findReps', function(req, res){
  var county = '';
  var actionName = req.body.action;
  var addy = req.body.address;
  var name = req.body.fullName;
  var zipcode = req.body.zip;
  Action.findOne({name : actionName}, function(err, action){
    targetOfficesNumbers = [];
    targetEmails = [];
    targetNames = [];
    targetOffices = [];
    console.log(action.tagname);
    console.log(action.cityCounty);

    var repsURL = 'https://www.googleapis.com/civicinfo/v2/representatives?address='+ addy + '&key=*GOOGLEAPIKEY*'

    request(repsURL, function(error, response, body){
      var city = JSON.parse(body).normalizedInput.city;
      officials = JSON.parse(body).officials;
      offices = JSON.parse(body).offices;
      divisions = JSON.parse(body).divisions;
      offices.forEach(function(office){
        if(action.level.includes(office.levels[0])){
          office.officialIndices.forEach(function(num){
              targetOfficesNumbers.push(num);
          });
        }
      });
      console.log(targetOfficesNumbers);
      targetOfficesNumbers.forEach(function(number){
        if(typeof(officials[number].emails) !== 'undefined'){
          officialName = officials[number].name;
          officialLName = officialName.split(' ').splice(-1)[0];
          targetNames.push(officialLName);
          targetEmails.push(officials[number].emails[0]);
          offices.forEach(function(office){
            if(office.officialIndices[0] === number){
              officeName = office.name;
              title = officeName.split(" ").splice(-1)[0];
              targetOffices.push(title);
            }
          })
        }
      })

      res.render('action', {
        officialsNames : targetNames,
        officialsTitles : targetOffices,
        zipcode: zipcode,
        emails : targetEmails,
        org : action.org,
        actionTitle : action.name,
        actionHeader : action.header,
        actionBody : action.body,
        actionDescription : action.desc,
        usersName : name,
        usersAddress : addy,
        inputName: name,
        tagname: action.tagname


      })
    });

  });
});












let port = process.env.PORT;
if (port ==null || port =="") {
  port = 3000;
}

app.listen(port, function(){
  console.log("Server has started successfully");
});
