const dotenv = require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require('mongoose-findorcreate');
const FacebookStrategy = require('passport-facebook').Strategy;
const _ = require('lodash');

const app = express();

app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(bodyParser.urlencoded( {extended:true} ));

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("PUT YOUR MONGODB CONNECTION URL HERE", {useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false });

const todoListSchema = new mongoose.Schema ({
    username: String,
    password: String,
    googleId: String,
    facebookId:String,
    listItems: [String]
});
todoListSchema.plugin(passportLocalMongoose);
todoListSchema.plugin(findOrCreate);

const TODOList = mongoose.model("TODOList",todoListSchema);

passport.use(TODOList.createStrategy());

passport.serializeUser(function(user, done) {
     done(null, user.id);
   });
   
   passport.deserializeUser(function(id, done) {
    TODOList.findById(id, function(err, user) {
       done(err, user);
     });
   });

passport.use(new GoogleStrategy({
     clientID: process.env.CLIENT_ID,
     clientSecret: process.env.CLIENT_SECRET,
     callbackURL: "https://todo-list-free.herokuapp.com/auth/google/list"
     //userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
   },
   function(token, tokenSecret, profile, done) {
        TODOList.findOrCreate({ googleId: profile.id, username: _.replace(profile.displayName, " ","") }, function (err, user) {
         return done(err, user);
       });
   }
 ));

 passport.use(new FacebookStrategy({
     clientID: process.env.FACEBOOK_APP_ID,
     clientSecret: process.env.FACEBOOK_APP_SECRET,
     callbackURL: "https://todo-list-free.herokuapp.com/auth/facebook/list"
   },
   function(accessToken, refreshToken, profile, done) {
    TODOList.findOrCreate({ facebookId: profile.id }, function(err, user) {
       if (err) { return done(err); }
       done(null, user);
     });
   }
 ));




app.get("/", function(req, res) {
    if(req.isAuthenticated()) {
        TODOList.find({_id:req.user.id},function(err, user){
            if(err)
                console.log(err);
            else {
                if(user[0].listItems.length == 0){

                    TODOList.findOneAndUpdate(
                        { _id: user[0].id }, 
                        { $push: { listItems: ["Welcome to the ToDo-List!", "Hit the + button to add a new item.", "<-- Hit this to delete an item."] } },
                    function (error, success) {
                            if (error) {
                                console.log(error);
                            } else {
                                res.redirect("/");
                            }
                        });
                } else {
                    res.render("list",{day: "Today", items: user[0].listItems});
                }
            }
        });
         
    } else {
         res.redirect("/login");
    }
});

app.get("/login", function(req, res) {
    res.render("login", {alert: false});
});

app.post("/login", function(req,res){

    if(req.body.username=="" || req.body.password==""){
        res.render("login", {alert: true, type: "danger", intro: "Empty Fields!", message: "Please enter username & password."});
    } else {

        const user = new TODOList({
            username: req.body.username,
            password: req.body.password
        });
       
        req.login(user, function(err) {
            if (err)  
                 res.redirect("/badlogin");
            else {
                 passport.authenticate("local", { failureRedirect: "/badlogin" })(req, res, function(){
                      res.redirect("/");
                 });
            }
        });
    }

});

app.get("/badlogin", function(req, res){
    res.render("login", {alert: true, type: "danger", intro: "Wrong Credentials!", message: "Please enter correct username & password."});
});

app.get("/badregister", function(req, res){
    res.render("register", {alert: true, type: "danger", intro: "User already exist!", message: "Please enter unique username & password."});
});

app.get("/register", function(req, res){
    res.render("register",{alert: false});
});

app.post("/register", function(req,res){

    if(req.body.username=="" || req.body.password=="") {
        res.render("register", {alert: true, type: "danger", intro: "Empty Fields!", message: "Please enter username & password."});
    } else {
        TODOList.register({username: req.body.username}, req.body.password, function(err, user){
            if(err)
                res.redirect("/badregister");
            else {
                 passport.authenticate("local", { failureRedirect: "/badregister" })(req, res, function(){
                      res.redirect("/");
                 });
            }
        });
    }

});

app.get("/auth/google",
     passport.authenticate("google", { scope: ["profile"] }));

app.get("/auth/google/list", 
     passport.authenticate("google", { failureRedirect: "/" }),
     function(req, res) {
          res.redirect("/");
     }
);

app.get('/auth/facebook',
  passport.authenticate('facebook', { scope: ["email"] })
);

app.get('/auth/facebook/list',
  passport.authenticate('facebook', { successRedirect: '/',
                                      failureRedirect: '/login' }));

app.post("/", function(req, res) {

    if (req.body.newItem!="") {
        const newItemName = req.body.newItem; 
        TODOList.findOneAndUpdate(
            { _id: req.user.id }, 
            { $push: { listItems: newItemName } },
            function (error, success) {
                if (error) {
                    console.log(error);
                } else {
                    res.redirect("/");
                }
            });
    }
});

app.post("/delete", function(req, res){
    TODOList.updateOne({_id: req.user.id}, {$pullAll: {listItems: [req.body.checkbox]}},function(err,data) {
        if(!err) {
            res.redirect("/");
        }
    });
    
});

app.get("/logout", function(req, res) {
    req.logout();
    res.redirect("/");
});





let port = process.env.PORT;
if(port == null || port == "") {
    port = 3000;
}

app.listen(port, function() {
    console.log("Server started on port: "+port);
});