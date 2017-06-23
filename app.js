const snoowrap = require('snoowrap');
const parse = require('excel');
const mongoose = require('mongoose');
const query = "in my opinion";
// const query = "cat";

var opinionValues = [];
var maxRepliesPerThread = 5;

if(!process.env.REDDIT_ID) {
  const env = require('./env.js');
}


// mongoDB + mongoose setup
mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI);

var replySchema = new mongoose.Schema({
	link_id: String,
    comment_id: String
}, 
{
	// capped databases have a max size and can listen for changes
	capped: {size: 5242880, max: 500, autoIndexId: true}
});
var Reply = mongoose.model("reply", replySchema);

// Reddit API setup
const r = new snoowrap({
  userAgent: 'bot',
  clientId: process.env.REDDIT_ID,
  clientSecret: process.env.REDDIT_SECRET,
  username: process.env.REDDIT_USERNAME,
  password: process.env.REDDIT_PASSWORD
});






init();




function init() {
    // read opinion values from excel spreadsheet
    parse('opinions.xlsx', function(err, data) {
        if(err) throw err;
        // data is an array of arrays
        opinionValues = flatten(data);
    });

    setInterval(scanAndReply, 60000);
}

function scanAndReply() {
    // r.getNewComments({limit: 500})
    r.getNewComments('test')
    .then(comments => Promise.all(comments.map(checkCommentBody)))
    .then(comments => Promise.all(comments.map(checkCommentAuthor)))
    .then(comments => Promise.all(comments.map(checkReplied)))
    .then(comments => Promise.all(comments.map(checkMaxReplies)))
    .then(comments => removeNull(comments))
    .then(comments => Promise.all(comments.map(reply)))
    .then(comments => console.log(comments))
}

function checkCommentBody(comment) {
	return new Promise(function(resolve) {
        // console.log("comment");
        if (comment != null && comment.body && comment.body.toLowerCase().includes(query)) {
            console.log("comment includes query");
            resolve(comment);
        } else {
            resolve(null);
        }
	});
}

function checkCommentAuthor(comment) {
    return new Promise(function(resolve) {
        if (comment != null && comment.author.name != process.env.REDDIT_USERNAME) {
            console.log("comment author is not bot");
            resolve(comment);
        } else {
            resolve(null);
        }
	});
}

function checkReplied(comment) {
    return new Promise(function(resolve) {
        if (comment == null) {
            resolve(null);
            return;
        }

        Reply.find({ comment_id: comment.id }, function(err, replies) {
            if (replies.length  < 1) {
                console.log("comment has not been replied to by bot");
                resolve(comment);
            } else {
                resolve(null);
            }
        });
	});
}

function checkMaxReplies(comment) {
    return new Promise(function(resolve) {
        if (comment == null) {
            resolve(null);
            return;
        } 

        Reply.find({ link_id: comment.link_id }, function(err, replies) {
            if (replies.length  < maxRepliesPerThread) {
                console.log("thread has less than max replies by bot");
                resolve(comment);
            } else {
                resolve(null);
            }
        });
	});
}

function reply(comment) {
    return new Promise(function(resolve) {
        if (comment != null) {
            var opinion = getOpinionString();
            comment.reply(opinion);

            var newReply = {
                link_id: comment.link_id,
                comment_id: comment.id
            }
            // add reply to database
            Reply.create(newReply, function(err, newReply) {
                if (err) {
                    console.log(err);
                } else {
                    resolve(comment);
                }
            });
        } else {
            resolve(null);
        }
	});
}

// removes null comment entries
function removeNull(comments) {
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

// generate a unique 'opinion' for each reply
function getOpinionString() {
    var opinions = [getRandomOpinion(), getRandomOpinion()];
    // regenerate opinions if they're identical
    while (opinions[0] === opinions[1]) {
        opinions[1] = getRandomOpinion();
    }
    
    response = "Well, in MY opinion, " + opinions[0] + " is better than " + opinions[1] + ".";

    return response;
}

function getRandomOpinion() {
    var rand = Math.floor(Math.random() * opinionValues.length);
    return opinionValues[rand];
}

function flatten(arr) {
  return arr.reduce(function (flat, toFlatten) {
    return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
  }, []);
}



