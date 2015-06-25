var http = require('http');
var port = 18080;
http.createServer(function (req, res){
	res.writeHEAD(200, {'Content-type':'text/html'});
	res.write('<h1>hi</h1>');
	res.end('there');
}).listen(port);

