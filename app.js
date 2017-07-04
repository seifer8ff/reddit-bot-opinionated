// -----------------  INCLUDES  -----------------

const snoowrap = require('snoowrap');
const parse = require('excel');
const mongoose = require('mongoose');


// -----------------  VARIABLES  -----------------

var opinionValues = [];


// -----------------  CONFIG  -----------------

if(!process.env.MONGODB_URI) {
  const env = require('./env.js');
}
mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI);


// -----------------  MAIN  -----------------

// initialize all bots (will begin scanning for query)
var opinionBot = new Bot("in my opinion", {
    clientId: process.env.OPINIONATEDBOT_REDDIT_ID,
    clientSecret: process.env.OPINIONATEDBOT_REDDIT_SECRET,
    username: process.env.OPINIONATEDBOT_REDDIT_USERNAME,
    password: process.env.OPINIONATEDBOT_REDDIT_PASSWORD
});




// -----------------  CLASSES  -----------------

function Bot(searchQuery, snoowrapParams) {
    var self = this;
    this.name = snoowrapParams.username;
    this.r = new snoowrap({
        userAgent: "bot",
        clientId: snoowrapParams.clientId,
        clientSecret: snoowrapParams.clientSecret,
        username: snoowrapParams.username,
        password: snoowrapParams.password
    });
    this.query = searchQuery;
    this.maxRepliesPerThread = 1;
    this.replySchema = new mongoose.Schema({
	    link_id: String,
        comment_id: String
    }, 
    {
	    // capped databases have a max size and can listen for changes
	    capped: {size: 5242880, max: 500, autoIndexId: true}
    });
    this.Reply = mongoose.model(self.name + "-reply", self.replySchema);
    this.wordArray;
    this.scanInterval;

    this.scanAndReply = function() {
        self.r.getNewComments({limit: 500})
        // self.r.getNewComments('test')
        .then(comments => Promise.all(comments.map(self.checkCommentBody)))
        .then(comments => Promise.all(comments.map(self.checkCommentAuthor)))
        .then(comments => Promise.all(comments.map(self.checkReplied)))
        .then(comments => Promise.all(comments.map(self.checkMaxReplies)))
        .then(comments => self.removeNull(comments))
        .then(comments => Promise.all(comments.map(self.reply)))
        .then(comments => console.log(comments))
    }

    // check that comment author is not bot
    this.checkCommentAuthor = function(comment) {
        return new Promise(function(resolve) {
            if (comment != null && comment.author.name != self.r.username) {
                console.log("comment author is not bot");
                resolve(comment);
            } else {
                resolve(null);
            }
        });
    }

    // check that this comment has not been replied to by bot already
    this.checkReplied = function(comment) {
        return new Promise(function(resolve) {
            if (comment == null) {
                resolve(null);
                return;
            }

            self.Reply.find({ comment_id: comment.id }, function(err, replies) {
                if (replies.length  < 1) {
                    console.log("comment has not been replied to by bot");
                    resolve(comment);
                } else {
                    resolve(null);
                }
            });
        });
    }

    // check that thread has not been replied to more than x times
    this.checkMaxReplies = function(comment) {
        return new Promise(function(resolve) {
            if (comment == null) {
                resolve(null);
                return;
            } 

            self.Reply.find({ link_id: comment.link_id }, function(err, replies) {
                if (replies.length  < self.maxRepliesPerThread) {
                    console.log("thread has less than max replies by bot");
                    resolve(comment);
                } else {
                    resolve(null);
                }
            });
        });
    }

    // removes null comment entries
    this.removeNull = function(comments) {
        return new Promise(function(resolve) {
            var validComments = [];
            for (let i = 0; i < comments.length; i++) {
                if (comments[i] != null) {
                    validComments.push(comments[i]);
                }
            }
            resolve(validComments);
        });
    }

    // check comment for matching query string
    this.checkCommentBody = function(comment) {
        return new Promise(function(resolve) {
            // console.log("comment");
            if (comment != null && comment.body && comment.body.toLowerCase().includes(self.query)) {
                console.log("comment includes query");
                resolve(comment);
            } else {
                resolve(null);
            }
        });
    }

    // reply to comment, and save thread id and comment id to DB
    this.reply = function(comment) {
        return new Promise(function(resolve) {
            if (comment != null) {
                var response = self.generateResponse();
                comment.reply(response)
                .catch(err => console.log(err.message))
                .then(comment => self.addReplyToDB(comment))
                .then(comment => resolve(comment))
            } else {
                resolve(null);
            }
        });
    }

    this.addReplyToDB = function(comment) {
        return new Promise(function(resolve) {
            if (comment != null) {
                var newReply = {
                    link_id: comment.link_id,
                    comment_id: comment.id
                }
                // add reply to database
                self.Reply.create(newReply, function(err, newReply) {
                    if (err) {
                        console.log(err);
                    } 
                    resolve(comment);
                });
            } else {
                resolve(null);
            }
        });
    }

    // generate a string response for replies
    this.generateResponse = function() {
        var words = [self.getRandWord(), self.getRandWord()];
        // regenerate opinions if they're identical
        while (words[0] === words[1]) {
            words[1] = self.getRandWord();
        }
        var response = "Well, in MY opinion, " + words[0] + " is better than " + words[1] + ".";

        return response;
    }

    // returns a single word from this bots word spreadsheet
    this.getRandWord = function() {
        var rand = Math.floor(Math.random() * self.wordArray.length);
        return self.wordArray[rand];
    }

    this.init = function() {
        // reads words from excel spreadsheet
        parse('opinions.xlsx', function(err, data) {
            if(err) throw err;
            // data is an array of arrays
            self.wordArray = flatten(data);
        });
        // begin scanning for matching posts every 60 seconds
        self.scanInterval = setInterval(self.scanAndReply.bind(this), 60000);
    }();
}


// -----------------  FUNCTIONS  -----------------

function flatten(arr) {
  return arr.reduce(function (flat, toFlatten) {
    return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
  }, []);
}