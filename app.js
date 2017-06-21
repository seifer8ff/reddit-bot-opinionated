const snoowrap = require('snoowrap');
const query = "in my opinion";

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

// That's the entire setup process, now you can just make requests.

// Submitting a link to a subreddit
// r.getSubreddit('gifs').submitLink({
//   title: 'Mt. Cameramanjaro',
//   url: 'https://i.imgur.com/n5iOc72.gifv'
// });

// Printing a list of the titles on the front page
// r.getHot().map(post => post.title).then(console.log);
// r.getSubreddit('test').search({query: 'in my opinion', sort: 'new'}).map(post => post.title).then(console.log);
r.getNewComments('test')
// .map(comments => checkCommentBody(comments))
.then(comments => checkCommentBody(comments))
.then(comments => checkCommentAuthor(comments))
.then(comments => replyToAll(comments))



// Extracting every comment on a thread
// r.getSubmission('4j8p6d').expandReplies({limit: Infinity, depth: Infinity}).then(console.log)

// Printing the content of a wiki page
// r.getSubreddit('AskReddit').getWikiPage('bestof').content_md.then(console.log);




// only move forward if author is not the bot
function checkCommentAuthor(comments) {
	return new Promise(function(resolve, reject) {
        console.log("checking comments authors");
        // console.log(comments);
        for (let i = 0; i < comments.length; i++) {
            if (comments[i].author.name === process.env.REDDIT_USERNAME) {
                console.log("found comment from bot");
                comments = removeFromThread(comments, comments[i].link_id);
                break;
            }
        }
        if (comments.length > 0) {
            resolve(comments);
        }
	});
}

// continue if body includes query string
function checkCommentBody(comments) {
	return new Promise(function(resolve, reject) {
        console.log("checking comments for matching query");
        var matchingComments = [];
        for (let i = 0; i < comments.length; i++) {
            if (comments[i].body && comments[i].body.toLowerCase().includes(query)) {
                console.log("includes query");
                matchingComments.push(comments[i]);
            }
        }
        if (matchingComments.length > 0) {
            resolve(matchingComments);
        }
	});
}

// remove all comments from a particular thread
function removeFromThread(comments, threadName) {
    console.log("removing all comments from thread: " + threadName);
    var validComments = [];
    for (let i = 0; i < comments.length; i++) {
        if (comments[i].link_id != threadName) {
            validComments.push(comments[i]);
        }
    }
    console.log(validComments);
    return validComments;
}

function replyToAll(comments) {
    return new Promise(function(resolve, reject) {
        console.log("replying to comments");
        for (let i = 0; i < comments.length; i++) {
            var opinion = generateOpinion();
            comments[i].reply(opinion);
        }
        if (comments.length > 0) {
            resolve(comments);
        }
	});
}

// generate a unique 'opinion' for each reply
function generateOpinion() {
    var response = "Well, in my opinion, ";
    var opinions = [
        "cats are better than dogs.", 
        "dogs are better than cats.", 
        "the world was better off before Trump was born.",
        "Reddit failed a long time ago.",
        "PC is better than console.",
        "Playstation is better than Micro$oft"
    ];
    var rand = Math.floor(Math.random() * opinions.length);
    response += opinions[rand];

    return response;
}