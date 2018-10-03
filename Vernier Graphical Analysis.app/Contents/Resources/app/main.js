const { app, BrowserWindow, shell, ipcMain, Menu, powerSaveBlocker } = require('electron');
const grpcServer = require('./resources/grpc_server');
const DEVELOPMENT = require('electron-is-dev');
// const fs = require('fs');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;
let openFilePath;
let pendingWindowCreation;

// change to the application's top-level directory
process.chdir(app.getAppPath());

function createMainWindow(appType = 'ga') {
  let config = {};
  if (appType === 'firmware-updater') {
    config = {
      width: 512,
      height: 703,
      title: 'Vernier Go Direct Firmware Udpater',
      indexPage: 'firmware-updater.html',
    };
  }
  if (appType === 'ga') {
    config = {
      width: 1024,
      height: 703,
      title: 'Vernier Graphical Analysis',
      indexPage: 'index.html',
    };
  }

  win = new BrowserWindow({
    width: config.width,
    height: config.height,
  });

  // use this to hide the file menu
  // win.setMenu(null);

  // and load the index.html of the app.
  win.loadURL(`file://${__dirname}/${config.indexPage}`);

  // Open the DevTools.
  if (DEVELOPMENT) {
    win.webContents.openDevTools();
  }

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.

    console.log('***** CLOSED ******');
    win = null;
    setTimeout(() => {
      grpcServer.stop().then(() => {
        if (pendingWindowCreation) {
          launchMainWindow(pendingWindowCreation);
          pendingWindowCreation = null;
        }
      }).catch((err) => {
        console.error(err);
      });
    });
  });

  // launch http links in a real browser window, not an electron window
  win.webContents.on('new-window', (e, url) => {
    e.preventDefault();
    shell.openExternal(url);
  });

  if (process.platform === 'darwin') {
    // Create the Application's main menu so that copy/paste works on mac
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: config.title,
        submenu: [
          { role: 'hide' },
          { role: 'hideothers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectall' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'togglefullscreen' }
        ]
      },
      {
        role: 'window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
        ]
      }
    ]));
  }
}

function launchMainWindow(appType = 'ga') {
  // ensure that the grpc/module starts up before
  // creating the application window
  grpcServer.start().then(() => {
    createMainWindow(appType);
  }).catch((err) => {
    console.error(err);
  });
}


// ///////////////////// AUTOUPDATER
const { autoUpdater } = require('electron-updater');

autoUpdater.autoDownload = false;
autoUpdater.allowPrerelease = true;

// send commands to the autoUpdater
ipcMain.on('check-for-updates', (event, arg) => {
  autoUpdater.checkForUpdates();
});

ipcMain.on('download-update', (event, arg) => {
  autoUpdater.downloadUpdate();
});

ipcMain.on('quit-and-install', (event, arg) => {
  autoUpdater.quitAndInstall(false); // https://github.com/electron-userland/electron-builder/wiki/Auto-Update#appupdaterquitandinstallissilent
});

// listen to events on the autoUpdater
autoUpdater.on('checking-for-update', () => {
  win.webContents.send('auto-update-checking-for-update', 'Checking for update...');
});
autoUpdater.on('update-available', (ev, info) => {
  win.webContents.send('auto-update-available', 'Update available.', info, ev);
});
autoUpdater.on('update-not-available', (ev, info) => {
  win.webContents.send('auto-update-not-available', 'Update not available.', info, ev);
});
autoUpdater.on('error', (ev, error) => {
  win.webContents.send('auto-update-error', 'Error in auto-updater.', error, ev);
});
autoUpdater.on('download-progress', (ev, progressObj) => { // windows only https://github.com/electron-userland/electron-builder/wiki/Auto-Update#event-download-progress
  win.webContents.send('auto-update-download-progress', 'Download progress...', progressObj, ev);
});
autoUpdater.on('update-downloaded', (ev, info) => {
  win.webContents.send('auto-update-downloaded', 'Update downloaded', info, ev);
});


// ///////////////////// FIRMWARE UPDATER
ipcMain.on('launch-firmware-updater', (event) => {
  pendingWindowCreation = 'firmware-updater';
  event.returnValue = true; // this is sent synchronously, so give a response
});

ipcMain.on('launch-ga', (event) => {
  pendingWindowCreation = 'ga';
  event.returnValue = true; // this is sent synchronously, so give a response
});


// ///////////////////// OPENING FILES
// Check if app was started with via a filepath and return path to the render process
ipcMain.on('check-start-file', (/* event */) => {
  win.webContents.send('startup-filepath', openFilePath);
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

app.on('ready', () => {
  launchMainWindow();
  const id = powerSaveBlocker.start('prevent-app-suspension');
  console.log(`powerSaveBlocker "prevent-app-suspension": ${powerSaveBlocker.isStarted(id)}`);

  // Redux dev tools
  // https://github.com/MarshallOfSound/electron-devtools-installer
  // https://github.com/zalmoxisus/redux-devtools-extension
  if (DEVELOPMENT) {
    const { 'default': installExtension, REDUX_DEVTOOLS } = require('electron-devtools-installer');
    installExtension(REDUX_DEVTOOLS)
      .then((name) => { console.log(`Added Extension:  ${name}`); })
      .catch((err) => { console.log('An error occurred: ', err); });
  }

  if (process.platform == 'win32' && process.argv.length >= 2) {
    openFilePath = process.argv[1];
  }

  app.on('open-file', (event, path) => {
    // If we do not have a window, then just return
    // this happens when the app is started twice in rappid
    // succession; this function triggers before the the
    // Electron single instance handler deals with the second
    // instance, see RM 38307
    if (!win) {
      return;
    }

    openFilePath = path;

    if (process.platform == 'win32' && process.argv.length >= 2) {
      openFilePath = process.argv[1];
    }

    win.webContents.send('startup-filepath', openFilePath);
  });
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
//  if (process.platform !== 'darwin') {
//    app.quit()
//  }

  // if all windows have closed and there is no pending window to create,
  // quit the application
  if (!pendingWindowCreation) {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    launchMainWindow();
  }
});
