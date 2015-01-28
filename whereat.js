Router.configure({
  layoutTemplate: 'layout'
});

Router.route('/', function() {
  this.render('home', {
    data: function() {
      return { cellyAppId: Meteor.settings.public.cellyAppId, userId: Meteor.userId() };
    }
  });
});

Router.route('/cellyAuthCallback/:userId', function() {
  t = this;
  var userId = this.params.userId;
  var authCode = this.params.query.code;
  var postParams = {
    client_id: Meteor.settings.public.cellyAppId,
    client_secret: Meteor.settings.cellyAppSecret,
    grant_type: 'authorization_code',
    code: authCode
  };
  var querystring = Npm.require('querystring');
  var postData = querystring.stringify(postParams);
  var http = Npm.require('https');
  var postOptions = {
    hostname: 'cel.ly',
    port: 443,
    path: '/api/token',
    method: 'POST',
    headers: {
      'User-Agent': 'Node.js'
    }    
  };
  var req = http.request(postOptions, Meteor.bindEnvironment(function(result) { 
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
}, {where: 'server'});

if (Meteor.isClient) {
  Deps.autorun(function() {
    Meteor.subscribe('userData');
  });

  Template.home.events({
    'click button': function() {}
  });
}

if (Meteor.isServer) {
  Meteor.startup(function() {
  });

  Meteor.publish('userData', function() {
    if (!this.userId) return null;
    return Meteor.users.find(this.userId, {fields: {
      cellyToken: 1,
    }});
  });  
}