// Dependencies

var express = require("express");
var exphbs = require("express-handlebars");
var body = require("body-parser");
var mongoose = require("mongoose");
var logger = require("morgan");
var cheerio = require("cheerio");
var Note = require("./models/Note");
var Article = require("./models/Article");
var axios = require("axious");


// Connect to the Mongo DB
mongoose.connect("mongodb://localhost/newyorktimes", { useNewUrlParser: true });

// If deployed, use the deployed database. Otherwise use the local mongoHeadlines database
var MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost/newyorktimes';;

// Connect to the Mongo DB
mongoose.connect(MONGODB_URI);


var app = express();
var port = process.env.PORT || 3000;

// app set-ups

app.use(logger("dev"));
app.use(express.static("public"));
app.use(body.urlencoded({extended: false}));
// app.use(method("_method"));
app.engine("handlebars", exphbs({defaultLayout: "main"}));
app.set("view engine", "handlebars");

app.listen(port, function() {
	console.log("Listening on port " + port);
})

// Routes

app.get("/", function(req, res) {
	Article.find({}, null, {sort: {created: -1}}, function(err, data) {
		if(data.length === 0) {
			res.render("placeholder", {message: "There's nothing scraped yet. Click \"Scrape For Newest Articles\" "});
		}
		else{
			res.render("index", {articles: data});
		}
	});
});

// A GET route for scraping the echoJS website
app.get("/scrape", function(req, res) {
    // First, we grab the body of the html with axios
    axios.get("http://www.newyorktimes.com/").then(function(response) {
      // Then, we load that into cheerio and save it to $ for a shorthand selector
      var $ = cheerio.load(response.data);
  
      // Now, we grab every h2 within an article tag, and do the following:
      $("article h2").each(function(i, element) {
        // Save an empty result object
        var result = {};
  
        // Add the text and href of every link, and save them as properties of the result object
        result.title = $(this)
          .children("a")
          .text();
        result.link = $(this)
          .children("a")
          .attr("href");
  
        // Create a new Article using the `result` object built from scraping
        db.Article.create(result)
          .then(function(dbArticle) {
            // View the added result in the console
            console.log(dbArticle);
          })
          .catch(function(err) {
            // If an error occurred, send it to the client
            return res.json(err);
          });
      });
  
      // If we were able to successfully scrape and save an Article, send a message to the client
      res.send("Scrape Complete");
    });
  });

// app.get("/scrape", function(req, res) {
// 	request("https://www.nytimes.com/", function(error, response, html) {
// 		var $ = cheerio.load(html);
// 		var result = {};
// 		$("div.story-body").each(function(i, element) {
// 			var link = $(element).find("a").attr("href");
// 			var title = $(element).find("h2.headline").text().trim();
// 			var summary = $(element).find("p.summary").text().trim();
// 			var img = $(element).parent().find("figure.media").find("img").attr("src");
// 			result.link = link;
// 			result.title = title;
// 			if (summary) {
// 				result.summary = summary;
// 			};
// 			if (img) {
// 				result.img = img;
// 			}
// 			else {
// 				result.img = $(element).find(".wide-thumb").find("img").attr("src");
// 			};
// 			var entry = new Article(result);
// 			Article.find({title: result.title}, function(err, data) {
// 				if (data.length === 0) {
// 					entry.save(function(err, data) {
// 						if (err) throw err;
// 					});
// 				}
// 			});
// 		});
// 		console.log("Scrape finished.");
// 		res.redirect("/");
// 	});
// });

app.get("/saved", function(req, res) {
	Article.find({issaved: true}, null, {sort: {created: -1}}, function(err, data) {
		if(data.length === 0) {
			res.render("placeholder", {message: "You have not saved any articles yet. Try to save some delicious news by simply clicking \"Save Article\"!"});
		}
		else {
			res.render("saved", {saved: data});
		}
	});
});

app.get("/:id", function(req, res) {
	Article.findById(req.params.id, function(err, data) {
		res.json(data);
	})
})

app.post("/search", function(req, res) {
	console.log(req.body.search);
	Article.find({$text: {$search: req.body.search, $caseSensitive: false}}, null, {sort: {created: -1}}, function(err, data) {
		console.log(data);
		if (data.length === 0) {
			res.render("placeholder", {message: "Nothing has been found. Please try other keywords."});
		}
		else {
			res.render("search", {search: data})
		}
	})
});

app.post("/save/:id", function(req, res) {
	Article.findById(req.params.id, function(err, data) {
		if (data.issaved) {
			Article.findByIdAndUpdate(req.params.id, {$set: {issaved: false, status: "Save Article"}}, {new: true}, function(err, data) {
				res.redirect("/");
			});
		}
		else {
			Article.findByIdAndUpdate(req.params.id, {$set: {issaved: true, status: "Saved"}}, {new: true}, function(err, data) {
				res.redirect("/saved");
			});
		}
	});
});

app.post("/note/:id", function(req, res) {
	var note = new Note(req.body);
	note.save(function(err, doc) {
		if (err) throw err;
		Article.findByIdAndUpdate(req.params.id, {$set: {"note": doc._id}}, {new: true}, function(err, newdoc) {
			if (err) throw err;
			else {
				res.send(newdoc);
			}
		});
	});
});

app.get("/note/:id", function(req, res) {
	var id = req.params.id;
	Article.findById(id).populate("note").exec(function(err, data) {
		res.send(data.note);
	})
})