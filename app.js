require("dotenv").config();
var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var mongoose = require("mongoose");
var passport = require("passport");
var LocalStrategy = require("passport-local");
var Campground = require("./models/campground");
var User = require("./models/user");
var seedDB = require("./models/seeds");
var Comment = require("./models/comment"); 
var methodOverride = require("method-override");
var flash = require("connect-flash");
var NodeGeocoder = require('node-geocoder');
 
var options = {
  provider: 'google',
  httpAdapter: 'https',
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};
 
var geocoder = NodeGeocoder(options);
//seedDB();
//mongodb://localhost/yelp_camp
//mongodb+srv://sanskar:Gopikirotia%231@cluster0-dzqww.mongodb.net/test?retryWrites=true&w=majority
//mongodb+srv://sanskaragg:gopikiroti@cluster0-frbcf.mongodb.net/test?retryWrites=true&w=majority
mongoose.connect("mongodb+srv://sanskaragg:gopikiroti@cluster0-frbcf.mongodb.net/test?retryWrites=true&w=majority",{ 
    useNewUrlParser: true,
    useCreateIndex: true
}).then(() => {
    console.log("Connected to DB!");
}).catch(err => {
    console.log("Error: ",err.message);
});
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine","ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());
app.use(require("express-session")({
    secret: "Camping is Love",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next){
    res.locals.currentUser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
});

app.get("/",function(req,res){
	res.render("landing");
});

app.post("/campgrounds", isLoggedIn, function(req, res){
    var name = req.body.name;
    var image = req.body.image;
    var desc = req.body.description;
    var author = {
        id: req.user._id,
        username: req.user.username
    }
    var price = req.body.price;
    geocoder.geocode(req.body.location, function (err, data) {
      console.log(data);
      var r=1;
      if (err || !data.length) {
        console.log(err);
        r=0;
      //  req.flash('error', 'Invalid address');
      //  return res.redirect('back');
      }
      if(r){
        var lat = data[0].latitude;
        var lng = data[0].longitude;
        var location = data[0].formattedAddress;
      }
      else{
        var lat = 37.798648;
        var lng = -119.621285;
        var location = "hYosenite National Park, California, USA";
      }
      var newCampground = {name: name, image: image, description: desc, author:author, location: location, lat: lat, lng: lng};
      Campground.create(newCampground, function(err, newlyCreated){
          if(err){
              console.log(err);
          } else {
              console.log(newlyCreated);
              res.redirect("/campgrounds");
          }
      });
    });
  });
app.get("/campgrounds/new", isLoggedIn,function(req, res){
	res.render("./campgrounds/new");
});

app.get("/campgrounds",function(req,res){
    Campground.find({},function(err,allCampgrounds){
        if(err) console.log(err);
        else{
            res.render("./campgrounds/index",{campgrounds: allCampgrounds})
        }
    });
    //res.render("campgrounds",{campgrounds:campgrounds});
});

app.get("/campgrounds/:id",function(req,res){
    Campground.findById(req.params.id).populate("comments").exec(function(err,foundCampground){
        if(err) console.log(err);
        else{
            res.render("./campgrounds/show", {campground: foundCampground});
        }
    });
});

app.get("/campgrounds/:id/edit", checkCampgroundOwnership,function(req,res){
    Campground.findById(req.params.id, function(err, foundCampground){
        if(err) res.redirect("/campgrounds");
        else res.render("./campgrounds/edit", {campground: foundCampground});
    });
});

app.put("/campgrounds/:id", checkCampgroundOwnership, function(req, res){
    geocoder.geocode(req.body.location, function (err, data) {
    console.log(data);
    var r=1;
      if (err || !data.length) {
        console.log(err);
        r=0;
      //  req.flash('error', 'Invalid address');
      //  return res.redirect('back');
      }
    if(r){  
      req.body.campground.lat = data[0].latitude;
      req.body.campground.lng = data[0].longitude;
      req.body.campground.location = data[0].formattedAddress;
    }
    else{
        req.body.campground.lat = 37.798648;
      req.body.campground.lng = -119.621285;
      req.body.campground.location = "Yosenite National Park, California, USA";
    }
      Campground.findByIdAndUpdate(req.params.id, req.body.campground, function(err, campground){
          if(err){
              req.flash("error", err.message);
              res.redirect("back");
          } else {
              req.flash("success","Successfully Updated!");
              res.redirect("/campgrounds/" + campground._id);
          }
      });
    });
  });

app.delete("/campgrounds/:id", checkCampgroundOwnership, function(req,res){
    Campground.findByIdAndDelete(req.params.id, function(err){
        if(err) res.redirect("/campgrounds");
        else res.redirect("/campgrounds");
    });
});

app.get("/campgrounds/:id/comments/new", isLoggedIn,function(req,res){
    Campground.findById(req.params.id, function(err, campground){
        if(err) console.log(err);
        else res.render("./comments/new", {campground: campground});
    });
});

app.post("/campgrounds/:id/comments", isLoggedIn, function(req,res){
    Campground.findById(req.params.id, function(err, campground){
        if(err) res.redirect("/campgrounds");
        else Comment.create(req.body.comment, function(err, comment){
            if(err) console.log(err);
            else {
                comment.author.id = req.user._id;
                comment.author.username = req.user.username;
                comment.save();
                campground.comments.push(comment);
                campground.save();
                req.flash("success","Successfully added comment!");
                res.redirect("/campgrounds/" + campground._id);
            }
        });
    }); 
});

app.get("/campgrounds/:id/comments/:comment_id/edit", checkCommentOwnership, function(req,res){
    Comment.findById(req.params.comment_id, function(err, foundComment){
        if(err) res.redirect("back");
        else res.render("comments/edit", {campground_id: req.params.id, comment: foundComment});
    });
});

app.put("/campgrounds/:id/comments/:comment_id", checkCommentOwnership, function(req,res){
    Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, function(err, updatedComment){
        if(err) res.redirect("back");
        else res.redirect("/campgrounds/" + req.params.id);
    });
});

app.delete("/campgrounds/:id/comments/:comment_id", checkCommentOwnership, function(req,res){
    Comment.findByIdAndRemove(req.params.comment_id, function(err){
        if(err) res.redirect("back");
        res.redirect("/campgrounds/" + req.params.id);
    });
});

app.get("/register",function(req,res){
    res.render("register");
});

app.post("/register", function(req,res){
    var newUser = new User({username: req.body.username});
    User.register(newUser, req.body.password, function(err, user){
        if(err){
            req.flash("error",err.message);
            return res.render("register");
        }
        passport.authenticate("local")(req, res, function(){
            req.flash("success","Welcome to YelpCamp " + user.username);
            res.redirect("/campgrounds");
        });
    });
});

app.get("/login", function(req,res){
    res.render("login");
});

app.post("/login", passport.authenticate("local",
    {
        successRedirect: "/campgrounds",
        failureRedirect: "/login"
    }), function(req,res){
});

app.get("/logout", function(req,res){
    req.logout();
    req.flash("success","Logged you out!");
    res.redirect("/campgrounds");
});

function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    req.flash("error", "You need to be logged in to do that!");
    res.redirect("/login");
}

function checkCampgroundOwnership(req, res, next){
    if(req.isAuthenticated()){
        Campground.findById(req.params.id, function(err, foundCampground){
            if(err){
                req.flash("error","Campoground not found");
                res.redirect("back");
            }
            else{
                if(foundCampground.author.id.equals(req.user._id)){
                    next();
                }
                else{
                    req.flash("error","You don't have permission to do that");
                    res.redirect("back");
                }    
            }
        });
    } 
    else{
        req.flash("error","You need to be logged in to do that!");
        res.redirect("back");
    }
}

function checkCommentOwnership(req, res, next){
    if(req.isAuthenticated()){
        Comment.findById(req.params.comment_id, function(err, foundComment){
            if(err) res.redirect("back");
            else{
                if(foundComment.author.id.equals(req.user._id)){
                    next();
                }
                else{
                    req.flash("error","You don't have permission to do that");
                    res.redirect("back");
                }
            }
        });
    } 
    else{
        req.flash("error","You need to be logged in to do that!");
        res.redirect("back");
    }
}

//process.env.PORT, process.env.IP

app.listen(3000, function(){
	console.log("Server is on");
});