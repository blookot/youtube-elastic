const API_KEY = 'AIzaSyDj2G0uEpi-eQMpo95F90HHeCHJ2gpEHJ0'; // specify your API key here
const ES_IP = '10.132.0.3';

// Add this to the VERY top of the first file loaded in your application
var apm = require('elastic-apm-node').start({
    // Set required service name (allowed characters: a-z, A-Z, 0-9, -, _, and space)
    serviceName: 'youtube_demo',
    // Use if APM Server requires a token
    secretToken: '',
    // Set custom APM Server URL (default: http://localhost:8200)
    serverUrl: 'http://' + ES_IP + ':8200'
})

var elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({
  host: ES_IP + ':9200',
  log: 'error'
});
client.ping({
  requestTimeout: 30000,
}, function (err) {
  if (err) {
    console.error('Elasticsearch cluster is down!');
    console.trace(err.message);
  } else {
    console.log('Elasticsearch is answering\n\n');
  }
});

const cTable = require('console.table');
var {google} = require('googleapis');
//var youtube = google.youtube('v3');
var youtube = google.youtube({
  version: 'v3',
  auth: API_KEY
});

// will store all videos
var allVideos = [];

var lineReader = require('readline').createInterface({
  input: require('fs').createReadStream('topartists.txt')
});

lineReader.on('line', function (line) {
  console.log('Line from file:', line);
  var sleep = require('sleep');
  sleep.sleep(1);

  // search
  youtube.search.list({
    part: 'id,snippet',
    q: line,
    maxResults: 20
  }, (err, res) => {
    if (err) {
      console.error("Error on YouTube video search :-(");
      console.trace(err.message);
    } else {
      var vids = res.data.items;
      vids.forEach(function(vid) {
        //console.log(JSON.parse(JSON.stringify(vid)));
        if (vid.id.kind == "youtube#video") {
          var video = {
            id: vid.id.videoId,
            //url:  https://youtu.be/ + vid.id.videoId,
            title: vid.snippet.title,
            desc: vid.snippet.description,
            publishedAt: vid.snippet.publishedAt,
            thumbnailUrlDef: vid.snippet.thumbnails.default.url
          };
          //console.log(JSON.parse(JSON.stringify(video)));
          allVideos.push(video);
          var sleep = require('sleep');
          sleep.sleep(1);

          youtube.videos.list({
            part: 'snippet,contentDetails,statistics',
            id: vid.id.videoId
          }, (err, res) => {
            if (err) {
              console.error("Error on YouTube video list :-(");
              console.trace(err.message);
            } else {
              allVideos.forEach(function(v) {
                if (v.id == res.data.items[0].id) {
                  //console.log(JSON.parse(JSON.stringify(res.data.items[0])));
                  // if no thumbnail in std quality, default to high
                  try {
                    v.thumbnailUrlStd = res.data.items[0].snippet.thumbnails.standard.url;
                  } catch (err) {
                    v.thumbnailUrlStd = res.data.items[0].snippet.thumbnails.high.url;
                  }
                  v.duration = res.data.items[0].contentDetails.duration;  // PT1H30M34S or PT5M43S for example
                  v.viewCount = res.data.items[0].statistics.viewCount;
                  v.likeCount = res.data.items[0].statistics.likeCount;
                  v.dislikeCount = res.data.items[0].statistics.dislikeCount;
                  v.commentCount = res.data.items[0].statistics.commentCount;
                  //console.table(v);
                  //console.log(JSON.parse(JSON.stringify(video)));
                  //console.log("*****");
                  var sleep = require('sleep');
                  sleep.sleep(1);

                  // insert (or update) the video in ES
                  client.index({
                   index: 'youtube_demo',
                   type: 'doc',
                   id: v.id,
                   body: {
                     title: v.title,
                     desc: v.desc,
                     publishedAt: v.publishedAt,
                     duration: v.duration,
                     thumbnailUrlDef: v.thumbnailUrlDef,
                     thumbnailUrlStd: v.thumbnailUrlStd,
                     viewCount: v.viewCount,
                     likeCount: v.likeCount,
                     dislikeCount: v.dislikeCount,
                     commentCount: v.commentCount
                   }
                 }, function (err, res) {
                   if (err) {
                     console.error("ES insertion didn't work :-(");
                     console.trace(err.message);
                   } else {
                     console.log("ES insertion OK");
                   }
                 });
                }
              });
            }
          });
        }
      });
    }
  });
});


// count videos
client.count({
  index: 'youtube_demo'
}, function (err, res) {
  if (err) {
    console.error("ES count didn't work :-(");
    console.trace(err.message);
  } else {
    console.log("ES count OK\n\n");
    var count = res.count;
    console.log("Count: " + count);
  }
});
