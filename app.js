const snoowrap = require('snoowrap');
const parse = require('excel');
const query = "in my opinion";
var opinionValues = [];

if(!process.env.REDDIT_ID) {
  const env = require('./env.js');
}

// NOTE: The following examples illustrate how to use snoowrap. However, hardcoding
// credentials directly into your source code is generally a bad idea in practice (especially
// if you're also making your source code public). Instead, it's better to either (a) use a separate
// config file that isn't committed into version control, or (b) use environment variables.

// Create a new snoowrap requester with OAuth credentials.
// For more information on getting credentials, see here: https://github.com/not-an-aardvark/reddit-oauth-helper
const r = new snoowrap({
  userAgent: 'bot',
  clientId: process.env.REDDIT_ID,
  clientSecret: process.env.REDDIT_SECRET,
  username: process.env.REDDIT_USERNAME,
  password: process.env.REDDIT_PASSWORD
});

// read opinion values from excel spreadsheet
parse('opinions.xlsx', function(err, data) {
  if(err) throw err;
    // data is an array of arrays
    opinionValues = flatten(data);
});

activateBot();








function activateBot() {
    r.getNewComments('test')
    .then(comments => Promise.all(comments.map(checkCommentBody)))
    .then(comments => Promise.all(comments.map(checkCommentAuthor)))
    .then(comments => Promise.all(comments.map(checkAlreadyReplied)))
    .then(comments => Promise.all(comments.map(checkMaxBotReplies)))
    .then(comments => Promise.all(comments.map(reply)))
    .then(results => console.log(results))
}

function checkCommentBody(comment) {
	return new Promise(function(resolve) {
        if (comment != null && comment.body && comment.body.toLowerCase().includes(query)) {
            resolve(comment);
        } else {
            resolve(null);
        }
	});
}

function checkCommentAuthor(comment) {
    return new Promise(function(resolve) {
        if (comment != null && comment.author.name != process.env.REDDIT_USERNAME) {
            resolve(comment);
        } else {
            resolve(null);
        }
	});
}

function reply(comment) {
    return new Promise(function(resolve) {
        if (comment != null) {
            var opinion = getOpinionString();
            comment.reply(opinion);
            resolve(comment);
        } else {
            resolve(null);
        }
	});
}



// check that the bot has not posted > x times in this thread already
function checkMaxBotReplies(comment) {
	return new Promise(function(resolve) {
        if (comment === null) {
            resolve(null);
        }
        r.getSubmission(comment.link_id)
        .expandReplies({limit: Infinity, depth: Infinity})
        .then(replies => {
            console.log("got all thread replies");

            var counter = 0;
            counter = searchObj(replies, process.env.REDDIT_USERNAME, counter);
            console.log("counter = " + counter);

            if (counter > 5) {
                console.log("too many bot replies");
                resolve(null);
            } else {
                console.log("under 5 bot replies");
                resolve(comment);
            }
        })
	});
}

// check that the bot has not already replied to this comment
function checkAlreadyReplied(comment) {
	return new Promise(function(resolve) {
        if (comment === null) {
            resolve(null);
        }
        r.getComment(comment.id)
        .expandReplies({limit: Infinity, depth: Infinity})
        .then(replies => {
            console.log("got all parent comment replies");

            var counter = 0;
            counter = searchObj(replies, process.env.REDDIT_USERNAME, counter);
            console.log("counter = " + counter);

            if (counter > 0) {
                console.log("Bot has already replied to this comment");
                resolve(null);
            } else {
                resolve(comment);
            }
        })
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

function searchObj (obj, query, counter) {
    if (typeof counter != 'number') {
        counter = 0;
    }

    for (var key in obj) {
        var value = obj[key];

        if (typeof value === 'object') {
            counter = searchObj(value, query, counter);
        }

        if (key === "author") {
            value = obj.author.name;
            // console.log(key + " : " + value);
        } else {
            continue;
        }
        
        if (value === query) {
            counter += 1;
        }
    }
    return counter;
}
