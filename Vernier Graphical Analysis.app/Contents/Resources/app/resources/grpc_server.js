const grpc = require('./vstGrpcNodeModule.node');

let grpcServerPort = 0; // port on which the server is running; 0 == no server

// We use electron ipc to bootstrap grpc
// Messages:
//           getRpcServerPort -- returns the port on which server runs
//
const { ipcMain } = require('electron');

ipcMain.on('asynchronous-message', (event, arg) => {
  console.log('got event');
  console.dir(arg);
  if (arg === 'getRpcServerPort') {
    console.log('handling getRpcServerPort');
    event.sender.send('asynchronous-reply', {
      msg: arg,
      port: grpcServerPort
    });
  }
});

const service = {
  createClient() {
    console.error('GrpcServer.createClient() not implemented.');
  }
};

module.exports.start = function start() {
  console.log('Starting grpc server service');

  // Request the server is started on the given port
  return new Promise(((resolve) => {
    // data: custom data value we passed into the grpc module call
    // port: uint32_t value for the port
    grpc.startup((data, port) => {
      console.log('server started on port %d', port);
      grpcServerPort = port;
      setTimeout(() => {
        resolve(service);
      });
    }, null);
  }));
};


module.exports.stop = function stop() {
  console.log('Stopping grpc server service');

  return new Promise(((resolve) => {
    grpc.shutdown(() => {
      console.log('server shutdown');
      grpcServerPort = 0;
      setTimeout(() => {
        resolve();
      });
    });
  }));
};
