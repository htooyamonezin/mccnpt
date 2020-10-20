'use strict';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const APP_URL = "https://htoo.herokuapp.com";

//new text

// Imports dependencies and set up http server
const 
{ uuid } = require('uuidv4'),
  {format} = require('util'),
  request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  firebase = require("firebase-admin"),
  ejs = require("ejs"),  
  fs = require('fs'),
  multer  = require('multer'),  
  app = express(); 

const uuidv4 = uuid();


app.use(body_parser.json());
app.use(body_parser.urlencoded());


//app.locals.pageAccessToken = process.env.PAGE_ACCESS_TOKEN;

let bot_q = {
  askPhone: false,
  askHotel: false,
  askRestaurent:false
}

let user_input = {};




  
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
})

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits :{
    fileSize: 50 * 1024 * 1024  //no larger than 5mb
  }

});

// parse application/x-www-form-urlencoded




app.set('view engine', 'ejs');
app.set('views', __dirname+'/views');


var firebaseConfig = {
     credential: firebase.credential.cert({
    "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    "client_email": process.env.FIREBASE_CLIENT_EMAIL,
    "project_id": process.env.FIREBASE_PROJECT_ID,    
    }),
    databaseURL: process.env.FIREBASE_DB_URL,   
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  };


firebase.initializeApp(firebaseConfig);

let db = firebase.firestore(); 
let bucket = firebase.storage().bucket();


// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Accepts POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {  

  // Parse the request body from the POST
  let body = req.body;

  

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {
    body.entry.forEach(function(entry) {

      let webhook_event = entry.messaging[0];
      let sender_psid = webhook_event.sender.id; 

      if (webhook_event.message) {
        if(webhook_event.message.quick_reply){
            handleQuickReply(sender_psid, webhook_event.message.quick_reply.payload);
          }else{
            handleMessage(sender_psid, webhook_event.message);                       
          }                
      } else if (webhook_event.postback) {        
        handlePostback(sender_psid, webhook_event.postback);
      }
      
    });
    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

app.use('/uploads', express.static('uploads'));


app.get('/',function(req,res){    
    res.send('Your app is up and running');
});


app.get('/test',function(req,res){    
    res.render('test.ejs');
});

app.post('/test',function(req,res){
    const sender_psid = req.body.sender_id;     
    let response = {"text": "You  click delete button"};
    callSend(sender_psid, response);
});

/*********************************************
Gallery page
**********************************************/
app.get('/showimages/:sender_id/',function(req,res){
    const sender_id = req.params.sender_id;

    let data = [];

    db.collection("images").limit(20).get()
    .then(  function(querySnapshot) {
        querySnapshot.forEach(function(doc) {
            let img = {};
            img.id = doc.id;
            img.url = doc.data().url;          

            data.push(img);                      

        });
        console.log("DATA", data);
        res.render('gallery.ejs',{data:data, sender_id:sender_id, 'page-title':'welcome to my page'}); 

    }
    
    )
    .catch(function(error) {
        console.log("Error getting documents: ", error);
    });    
});


app.post('/imagepick',function(req,res){
      
  const sender_id = req.body.sender_id;
  const doc_id = req.body.doc_id;

  console.log('DOC ID:', doc_id); 

  db.collection('images').doc(doc_id).get()
  .then(doc => {
    if (!doc.exists) {
      console.log('No such document!');
    } else {
      const image_url = doc.data().url;

      console.log('IMG URL:', image_url);

      let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Is this the image you like?",
            "image_url":image_url,                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Yes!",
                  "payload": "yes",
                },
                {
                  "type": "postback",
                  "title": "No!",
                  "payload": "no",
                }
              ],
          }]
        }
      }
    }

  
    callSend(sender_id, response); 
    }
  })
  .catch(err => {
    console.log('Error getting document', err);
  });
      
});



/*********************************************
Gallery Page
**********************************************/

//webview test
app.get('/webview/:sender_id',function(req,res){
    const sender_id = req.params.sender_id;
    res.render('webview.ejs',{title:"Hello!! from WebView", sender_id:sender_id});
});

app.post('/webview',upload.single('file'),function(req,res){
       
      let name  = req.body.name;
      let email = req.body.email;
      let img_url = "";
      let sender = req.body.sender;  

      console.log("REQ FILE:",req.file);



      let file = req.file;
      if (file) {
        uploadImageToStorage(file).then((img_url) => {
            db.collection('webview').add({
              name: name,
              email: email,
              image: img_url
              }).then(success => {   
                console.log("DATA SAVED")
                thankyouReply(sender, name, img_url);    
              }).catch(error => {
                console.log(error);
              }); 
        }).catch((error) => {
          console.error(error);
        });
      }        
});

//Set up Get Started Button. To run one time
//eg https://fbstarter.herokuapp.com/setgsbutton
app.get('/setgsbutton',function(req,res){
    setupGetStartedButton(res);    
});

//Set up Persistent Menu. To run one time
//eg https://fbstarter.herokuapp.com/setpersistentmenu
app.get('/setpersistentmenu',function(req,res){
    setupPersistentMenu(res);    
});

//Remove Get Started and Persistent Menu. To run one time
//eg https://fbstarter.herokuapp.com/clear
app.get('/clear',function(req,res){    
    removePersistentMenu(res);
});

//whitelist domains
//eg https://fbstarter.herokuapp.com/whitelists
app.get('/whitelists',function(req,res){    
    whitelistDomains(res);
});


// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {
  

  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;  

  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];  
    
  // Check token and mode
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.status(200).send(challenge);    
    } else {      
      res.sendStatus(403);      
    }
  }
});

/**********************************************
Function to Handle when user send quick reply message
***********************************************/
function handleQuickReply(sender_psid, received_message) {

    console.log('QUICK REPLY', received_message);

    received_message = received_message.toLowerCase();

  switch(received_message) {   
        case "class":
          showClass(sender_psid);
          break;
        case "makeup review":
          threeReview(sender_psid);
          break;  
        case "on":
            showQuickReplyOn(sender_psid);
          break;
        case "off":
            showQuickReplyOff(sender_psid);
          break;                
        default:
            defaultReply(sender_psid);
  } 


 
}

/**********************************************
Function to Handle when user send text message
***********************************************/

const handleMessage = (sender_psid, received_message) => {
    console.log('TEXT REPLY', received_message);
  //let message;
  let response;

  if(bot_q.askHotel && received_message.text){
        user_input.hotel = received_message.text;
        bot_q.askHotel = false;        
        askRef(sender_psid);
      }

  else if(bot_q.askRestaurent && received_message.text){
        user_input.restaurent = received_message.text;
        bot_q.askRestaurent = false;
        askRef(sender_psid);
      }

  else if(bot_q.askRef && received_message.text){
        user_input.ref = received_message.text;
        bot_q.askRef = false;        
        updateItinerary(sender_psid, user_input.ref);
      }
  
  
  else if(received_message.attachments){
    let attachment_url = received_message.attachments[0].payload.url;
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Is this the right picture?",
            "subtitle": "Tap a button to answer.",
            "image_url": attachment_url,
            "buttons": [
              {
                "type": "postback",
                "title": "Yes!",
                "payload": "yes-attachment",
              },
              {
                "type": "postback",
                "title": "No!",
                "payload": "no-attachment",
              }
            ],
          }]
        }
      }
    }
    callSend(sender_psid, response);
  } else {
      
      let user_message = received_message.text;

      if(user_message.includes("Change Booking:")){
        let ref_num = user_message.slice(15);
        ref_num = ref_num.trim();
        updateBooking(sender_psid, ref_num);        
      }else{
          user_message = user_message.toLowerCase(); 

          switch(user_message) {
        case "hi":
          greeting(sender_psid);
          break;
        case "makeup":
          makeupType(sender_psid);
          break;
        case "makeup":
          makeupType(sender_psid);
          break;
        case "hello":        
          helloGreeting(sender_psid);
          break;
        case "text":
          textReply(sender_psid);
          break;
        case "quick":
          quickReply(sender_psid);
          break;
        case "button":        
          buttonReply(sender_psid);
          break;
        case "webview":
          webviewTest(sender_psid);
          break; 
        case "show expiry":
          showExpiry(sender_psid);
          break;
        case "hello eagle":
          helloEagle(sender_psid); 
          break;
        case "admin":
          adminCreatePackage(sender_psid); 
          break;         
        case "show packages":
          showTourPackages(sender_psid); 
          break;        
        case "private tour":
          privateTour(sender_psid); 
          break; 
        case "update itinerary":
          amendTour(sender_psid); 
          break; 
        case "change hotel":
          askHotel(sender_psid); 
          break;
        case "change restaurent":
          askRestaurent(sender_psid); 
          break;        
        case "show images":
          showImages(sender_psid)
          break;
        case "test delete":
          testDelete(sender_psid)
          break;        
        default:
            defaultReply(sender_psid);
        }          
      }     
      
    }

}

/*********************************************
Function to handle when user send attachment
**********************************************/

const handleAttachments = (sender_psid, attachments) => {
  
  console.log('ATTACHMENT', attachments);
  let response; 
  let attachment_url = attachments[0].payload.url;
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Is this the right picture?",
            "subtitle": "Tap a button to answer.",
            "image_url": attachment_url,
            "buttons": [
              {
                "type": "postback",
                "title": "Yes!",
                "payload": "yes-attachment",
              },
              {
                "type": "postback",
                "title": "No!",
                "payload": "no-attachment",
              }
            ],
          }]
        }
      }
    }
    callSend(sender_psid, response);
}

/*********************************************
Function to handle when user click button
**********************************************/
const handlePostback = (sender_psid, received_postback) => {

  let payload = received_postback.payload;

      console.log('BUTTON PAYLOAD', payload);

      if(payload.startsWith("class:")){
        let taskId = payload.slice(7);
        console.log('SELECTED class Is: class_name');
        showTime(sender_psid);
      }else{
        switch(payload) { 
      case "advance":
          showAdvance(sender_psid);
        break;
      case "yes":
          showButtonReplyYes(sender_psid);
        break;
      case "no":
          showButtonReplyNo(sender_psid);
        break;                      
      default:
          defaultReply(sender_psid);
         } 

      }
}

/*********************************************
makeup
**********************************************/
const makeupType = (sender_psid) => {
   let response1 = {"text": "မင်္ဂလာပါ။ Glamour By Moon Page က​နေကြိုဆိုပါတယ်။"};
   let response2 = {"text": "​​​အောက်​ဖော်ပြပါများအနက် မိတ်ကပ် review အ​ကြောင်းများကိုသိရှိလိုပါက Makeup Review ကိုနှိပ်​ပေးပါ။Makeup သင်တန်းအ​ကြောင်းသိရှိလိုပါက Makeup Class ကိုနှိပ်ပါ။",
    "quick_replies":[
            {
              "content_type":"text",
              "title":"Makeup Review",
              "payload":"Makeup Review",              
            },
            {
              "content_type":"text",
              "title":"Makeup Class",
              "payload":"Class",             
            }
    ]
  };

  callSend(sender_psid, response1).then(()=>{
    return callSend(sender_psid, response2);
  });
}

const threeReview = (sender_psid) => {
    let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Cosmetic Product Review",
            "subtitle": "Makeup Review",
            "image_url":"https://newlifeskincare.site/wp-content/uploads/2019/10/cosmetics.jpg",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Cosmetic Review",
                  "payload": "review:cosmetic",
                },               
              ],
          },
          {
            "title": "Skincare Product Review",
            "subtitle": "Makeup Review",
            "image_url":"https://previews.123rf.com/images/etoileark/etoileark1701/etoileark170100408/69378694-cartoon-girl-care-her-face-skin-care-beauty.jpg",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Skincare Review",
                  "payload": "review:skincare",
                },               
              ],
          },
          {
            "title": "Makeup Look Review",
            "subtitle": "Makeup Review",
            "image_url":"https://image.shutterstock.com/image-vector/handdrawn-womans-fresh-makeup-look-600w-745270495.jpg",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Makeup Look Review",
                  "payload": "review:look",
                },               
              ],
          }
        ]
      }
    }
      }
  callSend(sender_psid, response);
  
  }


const showClass = (sender_psid) => {
    let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Essential(Self-Makeup)",
            "subtitle": "Makeup Class",
            "image_url":"https://static.wixstatic.com/media/43b8cf_71e33f093e744a2b89a7d3131f079c47~mv2.jpg",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Essential Class",
                  "payload": "class:self",
                },               
              ],
          },
          {
            "title": "Advanced Makeup",
            "subtitle": "Makeup Class",
            "image_url":"https://3ewwlw1m6nye2hxpj916rtwa-wpengine.netdna-ssl.com/wp-content/uploads/2020/09/3-1024x543.png",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Advanced Makeup",
                  "payload": "class:advance",
                },               
              ],
          }
        ]
      }
    }
      }
  callSend(sender_psid, response);
  
  }

const showTime =(sender_psid) => {

  let response1 = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "ဒီတစ်ပတ်စနေနေ့ Weekend Self-Makeup Classရှိပါသည်။",    
            "buttons": [
                {
                  "type": "postback",
                  "title": "Sat 9am - 5pm",
                  "payload": "show:yes",
                },
              ],
          }]
        }
      }
    }
  let response2 = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "ဒီတစ်ပတ်စနေနေ့ Advanced Makeup Classရှိပါသည်။",    
            "buttons": [
                {
                  "type": "postback",
                  "title": "Sat&Sun 9am - 5pm",
                  "payload": "show:yes",
                },
              ],
          }]
        }
      }
    }
  

  callSend(sender_psid, response1).then(()=>{
    return callSend(sender_psid, response2);
  });
}

/*********************************************
end makeup
**********************************************/

/*********************************************
GALLERY SAMPLE
**********************************************/

const showImages = (sender_psid) => {
  let response;
  response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "show images",                       
            "buttons": [              
              {
                "type": "web_url",
                "title": "enter",
                "url": APP_URL+"/showimages/"+sender_psid,
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              },
              
            ],
          }]
        }
      }
    }
  callSendAPI(sender_psid, response);
}
/*********************************************
END GALLERY SAMPLE
**********************************************/
function webviewTest(sender_psid){
  let response;
  response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Click to open webview?",                       
            "buttons": [              
              {
                "type": "web_url",
                "title": "webview",
                "url": APP_URL+"/webview/"+sender_psid,
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              },
              
            ],
          }]
        }
      }
    }
  callSendAPI(sender_psid, response);
}

const greeting =(sender_psid) => {
  let response = {"text": "မင်္ဂလာပါ။ Glamour By Moon Page က​နေကြိုဆိုပါတယ်။"};
  callSend(sender_psid, response);
}


const helloGreeting =(sender_psid) => {
  let response = {"text": "မင်္ဂလာပါ။ Glamour By Moon Page က​နေကြိုဆိုပါတယ် ။ မိတ်ကပ် review များကိုသိရှိလိုပါက ' makeup ' လိုရိုက်ထည့်​ပေးပါ။"};
  callSend(sender_psid, response);
}


const textReply =(sender_psid) => {
  let response = {"text": "You sent text message"};
  callSend(sender_psid, response);
}


const quickReply =(sender_psid) => {
  let response = {
    "text": "Select your reply",
    "quick_replies":[
            {
              "content_type":"text",
              "title":"On",
              "payload":"on",              
            },{
              "content_type":"text",
              "title":"Off",
              "payload":"off",             
            }
    ]
  };
  callSend(sender_psid, response);
}

const showQuickReplyOn =(sender_psid) => {
  let response = { "text": "You sent quick reply ON" };
  callSend(sender_psid, response);
}

const showQuickReplyOff =(sender_psid) => {
  let response = { "text": "You sent quick reply OFF" };
  callSend(sender_psid, response);
}

const buttonReply =(sender_psid) => {

  let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Are you OK?",
            "image_url":"https://www.mindrops.com/images/nodejs-image.png",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Yes!",
                  "payload": "yes",
                },
                {
                  "type": "postback",
                  "title": "No!",
                  "payload": "no",
                }
              ],
          }]
        }
      }
    }

  
  callSend(sender_psid, response);
}

const showButtonReplyYes =(sender_psid) => {
  let response = { "text": "You clicked YES" };
  callSend(sender_psid, response);
}

const showButtonReplyNo =(sender_psid) => {
  let response = { "text": "You clicked NO" };
  callSend(sender_psid, response);
}

const thankyouReply =(sender_psid, name, img_url) => {
  let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Thank you! " + name,
            "image_url":img_url,                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Yes!",
                  "payload": "yes",
                },
                {
                  "type": "postback",
                  "title": "No!",
                  "payload": "no",
                }
              ],
          }]
        }
      }
    }
  callSend(sender_psid, response);
}

function testDelete(sender_psid){
  let response;
  response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Delete Button Test",                       
            "buttons": [              
              {
                "type": "web_url",
                "title": "enter",
                "url": APP_URL + "/test/",
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              },
              
            ],
          }]
        }
      }
    }
  callSendAPI(sender_psid, response);
}

const defaultReply = (sender_psid) => {
  let response1 = {"text": "To test text reply, type 'text'"};
  let response2 = {"text": "To test quick reply, type 'quick'"};
  let response3 = {"text": "To test button reply, type 'button'"};   
  let response4 = {"text": "To test webview, type 'webview'"};
    callSend(sender_psid, response1).then(()=>{
      return callSend(sender_psid, response2).then(()=>{
        return callSend(sender_psid, response3).then(()=>{
          return callSend(sender_psid, response4);
        });
      });
  });  
}

const callSendAPI = (sender_psid, response) => {  
  
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }
  
  return new Promise(resolve => {
    request({
      "uri": "https://graph.facebook.com/v6.0/me/messages",
      "qs": { "access_token": PAGE_ACCESS_TOKEN },
      "method": "POST",
      "json": request_body
    }, (err, res, body) => {
      if (!err) {
        //console.log('RES', res);
        console.log('BODY', body);
        resolve('message sent!')
      } else {
        console.error("Unable to send message:" + err);
      }
    }); 
  });
}

async function callSend(sender_psid, response){
  let send = await callSendAPI(sender_psid, response);
  return 1;
}


/*************************************
FUNCTION TO SET UP GET STARTED BUTTON
**************************************/
const setupGetStartedButton = (res) => {
  let messageData = {"get_started":{"payload":"get_started"}};

  request({
      url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token='+ PAGE_ACCESS_TOKEN,
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      form: messageData
    },
    function (error, response, body) {
      if (!error && response.statusCode == 200) {        
        res.send(body);
      } else { 
        // TODO: Handle errors
        res.send(body);
      }
  });
} 
/**********************************
FUNCTION TO SET UP PERSISTENT MENU
***********************************/

const setupPersistentMenu = (res) => {
  var messageData = { 
      "persistent_menu":[
          {
            "locale":"default",
            "composer_input_disabled":false,
            "call_to_actions":[
                {
                  "type":"postback",
                  "title":"View My Tasks",
                  "payload":"view-tasks"
                },
                {
                  "type":"postback",
                  "title":"Add New Task",
                  "payload":"add-task"
                },
                {
                  "type":"postback",
                  "title":"Cancel",
                  "payload":"cancel"
                }
          ]
      },
      {
        "locale":"default",
        "composer_input_disabled":false
      }
    ]          
  };
        
  request({
      url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token='+ PAGE_ACCESS_TOKEN,
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      form: messageData
  },
  function (error, response, body) {
      if (!error && response.statusCode == 200) {
          res.send(body);
      } else { 
          res.send(body);
      }
  });
} 

/***********************
FUNCTION TO REMOVE MENU
************************/

const removePersistentMenu = (res) => {
  var messageData = {
          "fields": [
             "persistent_menu" ,
             "get_started"                 
          ]               
  };  
  request({
      url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token='+ PAGE_ACCESS_TOKEN,
      method: 'DELETE',
      headers: {'Content-Type': 'application/json'},
      form: messageData
  },
  function (error, response, body) {
      if (!error && response.statusCode == 200) {          
          res.send(body);
      } else {           
          res.send(body);
      }
  });
} 

/***********************************
FUNCTION TO ADD WHITELIST DOMAIN
************************************/

const whitelistDomains = (res) => {
  var messageData = {
          "whitelisted_domains": [
             "https://htoo.herokuapp.com" , 
             "https://herokuapp.com" ,                                     
          ]               
  };  
  request({
      url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token='+ PAGE_ACCESS_TOKEN,
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      form: messageData
  },
  function (error, response, body) {
      if (!error && response.statusCode == 200) {          
          res.send(body);
      } else {           
          res.send(body);
      }
  });
} 