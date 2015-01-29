Router.configure({
  layoutTemplate: 'layout'
});

Router.route('/', function() {
  this.render('home', {
    data: function() {
      var coords = Geolocation.latLng();
      console.log(coords);
      return { 
        cellyAppId: Meteor.settings.public.cellyAppId,
        userId: Meteor.userId(),
        coords: coords
      };
    }
  });
});

Router.route('/shareLocation', function (){
  var t = this;
  var cellName = this.params.query.cellName;
  var cellyToken = this.params.query.cellyToken;
  var lng = t.params.query.lng;
  var lat = t.params.query.lat;
  var message = t.params.query.message;
  var geode = Meteor.npmRequire('geode');
  geo = new geode(Meteor.settings.geonamesUsername, { language: 'en', country : 'US' });
  geo.request("findNearestIntersection", { lat: lat, lng: lng }, Meteor.bindEnvironment(function(err, results) {
    if (err) {
      console.log(err);
    } else {
      console.log(results);
      var boroMap = {
        'Kings': 'Brooklyn',
        'Queens': 'Queens',
        'New York': 'Manhattan',
        'Richmond': 'Statend Island',
        'Bronx': 'The Bronx'
      };
      var data = results.intersection;
      var boro = (data.adminName2 ? " in " + boroMap[data.adminName2] : "");
      var text = (message ? message + " " : "") + "(I'm near " + data.street1 + " and " + data.street2 + boro + ")";
      Meteor.call("shareLocation", cellyToken, cellName, text);
    }
    t.response.writeHead(302, { 'Location': "/" });
    t.response.end();
  }));
}, { where: 'server' });

Router.route('/cellyAuthCallback/:userId', function() {
  t = this;
  var querystring = Npm.require('querystring');
  var https = Npm.require('https');
  var userId = this.params.userId;
  var authCode = this.params.query.code;
  var postParams = {
    client_id: Meteor.settings.public.cellyAppId,
    client_secret: Meteor.settings.cellyAppSecret,
    grant_type: 'authorization_code',
    code: authCode
  };
  
  var postData = querystring.stringify(postParams);
  var postOptions = {
    hostname: 'cel.ly',
    port: 443,
    path: '/api/token',
    method: 'POST',
    headers: {
      'User-Agent': 'Node.js'
    }    
  };
  var req = https.request(postOptions, Meteor.bindEnvironment(function(result) { 
    result.setEncoding('utf8');    
    result.on('data', Meteor.bindEnvironment(function (chunk) {
      var data = JSON.parse(chunk);
      Meteor.users.update({ _id: userId }, { $set: { 'cellyToken': data.access_token } });
      t.response.writeHead(302, { 'Location': "/" });
      t.response.end();
    }));
  }));
  req.on('error', Meteor.bindEnvironment(function(e) {
    console.log('celly token endpoint error:', e);
  }));
  req.write(postData);
  req.end();
}, { where: 'server' });

if (Meteor.isClient) {
  Deps.autorun(function() {
    Meteor.subscribe('userData');
  });

  Template.home.events({
  });
}

if (Meteor.isServer) {
  Meteor.startup(function() {
  });

  Meteor.publish('userData', function() {
    if (!this.userId) return null;
    return Meteor.users.find(this.userId, {fields: {
      cellyToken: 1,
      cellyCells: 1
    }});
  });  
}

Meteor.methods({
  getCells: function() {
    var https = Meteor.npmRequire('https');
    var reqOptions = {
      hostname: 'cel.ly',
      port: 443,
      path: '/api/me?oauth_token=' + Meteor.user().cellyToken,
      method: 'GET',
      headers: {
        'User-Agent': 'Node.js'
      }    
    };
    var req = https.request(reqOptions, Meteor.bindEnvironment(function(result) { 
      result.setEncoding('utf8');    
      result.on('data', Meteor.bindEnvironment(function (chunk) {
        var data = JSON.parse(chunk);
        console.log(data);
      }));
    }));
    req.on('error', Meteor.bindEnvironment(function(e) {
      console.log('celly token endpoint error:', e);
    }));
    req.end();
    console.log(req);    
  },

  shareLocation: function (cellyToken, cellName, text) {
    // if (!Meteor.userId()) {
    //   throw new Meteor.Error("not-authorized");
    // }

    // if (!Meteor.user().cellyToken) {
    //   throw new Meteor.error("no-celly-token");
    // }
    if (!text) {
      text = "test message";
    }

    var https = Meteor.npmRequire('https');
    var postParams = {
      oauth_token: cellyToken,
      message: { body: text }
    };
    var postData = JSON.stringify(postParams);
    var postOptions = {
      hostname: 'cel.ly',
      port: 443,
      path: '/api/cells/' + cellName + '/new-message',
      method: 'POST',
      headers: {
        'User-Agent': 'Node.js',
        'Content-Type': 'application/json'
      }    
    };
    var req = https.request(postOptions, Meteor.bindEnvironment(function(result) { 
      result.setEncoding('utf8');    
      result.on('data', Meteor.bindEnvironment(function (chunk) {
        var data = JSON.parse(chunk);
        console.log(data);
      }));
    }));
    req.on('error', Meteor.bindEnvironment(function(e) {
      console.log('celly token endpoint error:', e);
    }));
    req.write(postData);
    req.end();
    console.log(req);
  }
});