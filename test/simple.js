'use strict';
// eslint-disable-next-line no-var
var rocky = require('rocky');

rocky.on('secondcha', function(e) {
  console.log('time travel: ' + e.date);
});
