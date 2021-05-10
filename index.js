const {app,dialog,ipcMain, BrowserWindow,remote,Tray,Menu} = require('electron');
const Config = require('electron-config')
const fs=require('fs')
const path=require('path')
const axios = require('axios')
const config = new Config()


//Custom Log
var stockLog=console.log
var output=[]
console.log=(msg)=>{
  if (typeof msg ==='string'){
    output.push(String(msg))
  }else{
    try{output.push(JSON.stringify(msg,null,4))}
    catch{output.push(String(msg))} 
  } 
  stockLog(msg)
}

console.log(">> Starting OLED Clock Gamesense");

//C:\ProgramData\SteelSeries\SteelSeries Engine 3\coreProps.json
let win;
let consoleWin;
function createWindow() {    
    let opts={
        icon:"clock.png",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        width:480,
        height:155,
        frame:false,   
        resize:false 
    };

    try{
        Object.assign(opts,config.get('winBounds'))
    }catch(err){console.log(err);}

    win = new BrowserWindow(opts);    
    
    win.removeMenu(true)

    win.loadFile('index.html')
    win.on('close',()=>{       
      try{
        config.set('winBounds',win.getBounds())
      }catch(err){}
      if(process.platform !== 'darwin'){
        app.quit();
      }
    }) 

    let tray=null
    win.on('minimize',(event)=>{        
        event.preventDefault();
        win.setSkipTaskbar(true);
        win.hide();
        if(tray==null){
            tray = createTray();
            tray.displayBalloon({iconType:'info',title:"OLED Display has started in tray",content:"Double click to reopen"});
        }        
    })

    win.on('restore',(event)=>{        
        win.show();
        win.setSize(480,155);
        win.setSkipTaskbar(false);
    })

    win.minimize()
    // win.openDevTools({ detach: true });
    win.setResizable(false)
    
    // customConsole()
   
    
}

function customConsole(){
  if (consoleWin){
    try{
      consoleWin.show()
    }catch{
      consoleWin=null
      customConsole()
    }
  }
  else{
    let opts2={
      webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
      },
      frame:false,
      width:600,
      height:400,
    };
    try{
      Object.assign(opts2,config.get('consoleBounds'))
    }catch(err){console.log(err);}
    consoleWin= new BrowserWindow(opts2)
    consoleWin.loadFile('console.html')
    consoleWin.on('close',()=>{        
      // manager.stopService()
      try{
        config.set('consoleBounds',consoleWin.getBounds())
      }catch(err){}
    })
  } 
  // consoleWin.openDevTools({ detach: true });
}

app.whenReady().then(() => {     
      createWindow()  
      app.on('activate', () => {
          if (BrowserWindow.getAllWindows().length === 0) {        
              createWindow()
          }
  })
})

ipcMain.on('consoleClose',()=>{  
  console.log(">> Console Closed");
  config.set('consoleBounds',consoleWin.getBounds())
  consoleWin.close()   
})

ipcMain.on('console',()=>{  
  console.log(">> Console Opening");
  customConsole()
})

ipcMain.on('restart',()=>{  
  console.log("App has prepared for restart");
  try{
    config.set('winBounds',win.getBounds())
    config.set('consoleBounds',consoleWin.getBounds())
  }catch(err){}
  app.relaunch()
  app.exit()   
})

ipcMain.on('close',()=>{ 
  try{
    config.set('winBounds',win.getBounds())     
  }catch{}
  app.exit()
})

ipcMain.on('minimize',()=>{
  win.minimize()
})

// Tray Icon 
function createTray() {
  let appIcon = new Tray(path.join(path.dirname(__dirname),'clock.png'));
  const contextMenu = Menu.buildFromTemplate([
      {
          label: 'Show HUD', click: function () {
              win.show();
          }
      },
      {
          label: 'Exit', click: function () {
              app.isQuiting = true;
              try{
                config.set('winBounds',win.getBounds())     
              }catch{}
              app.exit()
          }
      }
  ]);

  appIcon.on('double-click', function (event) {
      win.show();
  });

  appIcon.setToolTip('OLED Screen Display');
  appIcon.setTitle("OLED Screen Display")
  appIcon.setContextMenu(contextMenu);
  return appIcon;
}

//Read Server Address from SteelSeries Engine Props
raw=fs.readFileSync('C:\\ProgramData\\SteelSeries\\SteelSeries Engine 3\\coreProps.json')
let props=JSON.parse(raw)

console.log(props.address)
const instance = axios.create({baseURL: 'http://'+String(props.address)})


//Register Game
register=["/game_metadata",
{
    "game": "CLOCK",
    "game_display_name": "OLED Screen Clock",
    "developer": "Primo"
}
]

//Remove Game
remove=["/remove_game",
{
    "game": "CLOCK",
}
]

//Removing Event
delEvent=["/remove_game_event",
{
  "game": "CLOCK",
  "event": "TIME"
}
]

//Blank Image
let img=[]
for (let i = 0; i < 128*40 /8; i++) {
  img.push(0)
}
// console.log(img.length);

//Bind a Event
addEvent=["/bind_game_event",
{
    "game": "CLOCK",
    "event": "TIME",
    "icon_id": 1,
    "handlers": [
      {
        "device-type": "screened-128x40",
        "mode": "screen",
        "zone": "one",
        "datas": [
          {
            "has-text": false,
            "image-data":img,
            "value-optional":true,
            "length-millis": 250
          }
        ]
      }
    ]
}
]

//Time Event
data=["/game_event",
{
  "game": "CLOCK",
  "event": "TIME",
  "data":{
    "value": 1,
    "value-optional":true,
    "frame": {
        "image-data-128x40":img
    }
  }
}
]

//Heart Beat (Keep Profile Alive)
heart=["/game_heartbeat",
{
  "game": "CLOCK"
}
]

function update(data){  
  instance.post(data[0],data[1])
  .then((res) => {
      if (data[0]=="/game_heartbeat") return 
      if (data[0]=="/game_event") return 
      console.log(`\n>${res.status} ${res.statusText} | ${res.config.url}`);
      // console.log(res.data);
  })
  .catch((res) => {
      res=res.response
      console.log(`\n>${res.status} ${res.statusText} | ${res.config.url}`);
      console.log(res.data);
  })
}

ipcMain.on('remove',()=>{  
  update(delEvent)  
})

ipcMain.on('add',()=>{  
  update(addEvent)  
})

ipcMain.on('removeGame',()=>{  
  update(remove)  
})

ipcMain.on('addGame',()=>{  
  update(register)  
})

//Value cycle 
let val=1
function iterVal(){
  val+=1
  if (val>99) val=1
  return val
}

//Read from image pixel array database
let imgArrays=[];
try{
  imgData=fs.readFileSync('array.json')
  imgArrays=JSON.parse(imgData)
}catch{
  src = path.join(path.dirname(__dirname),'array.json');
  console.log(src)
  imgData=fs.readFileSync(src)
  imgArrays=JSON.parse(imgData)
}

function getImg(){ 
  function formatAMPM(date) { //Format time to match key form
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0'+minutes : minutes;
    hours = hours < 10 ? '0'+hours : hours;
    var strTime = hours + ':' + minutes + ' ' + ampm;
    return strTime;
  } 

  var date = formatAMPM(new Date);
  // console.log(date);
  var pixels=imgArrays[date] //Get pixel array
  return pixels
}

ipcMain.handle('send',(event)=>{ 
  // console.log(data); 
  data[1].data.value=iterVal()
  data[1].data.frame['image-data-128x40']=getImg()
  update(data) 
  return data[1].data.frame['image-data-128x40']
})

keepAlive=true;
interval=setInterval(()=>{
  update(heart)
  if (!keepAlive){
    clearInterval(interval)
  }
},14000)
ipcMain.on('heart',()=>{  
  keepAlive= !keepAlive
  console.log(`$> Gamesense Heartbeat set to ${keepAlive}`);
  if(keepAlive){
    interval=setInterval(()=>{
      update(heart)
      if (!keepAlive){
        clearInterval(interval)
      }
    },14000)
  }
})

isConstant=true;
let constant=setInterval(()=>{
  data[1].data.value=iterVal()
  data[1].data.frame['image-data-128x40']=getImg()
  update(data)
  if (!isConstant){
    clearInterval(constant)
  }
},50)
ipcMain.on('constant',()=>{  
  isConstant= !isConstant
  console.log(`$> Gamesense Constant Update set to ${isConstant}`);
  if(isConstant){
    constant=setInterval(()=>{
      data[1].data.value=iterVal()
      data[1].data.frame['image-data-128x40']=getImg()
      update(data)
      if (!isConstant){
        clearInterval(constant)
      }
    },50)
  }
})


ipcMain.handle('console',(event)=>{
  return output
})