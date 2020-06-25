'use strict';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const APP_URL = "https://fbstarter.herokuapp.com";

//new text

// Imports dependencies and set up http server
const 
  request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  firebase = require("firebase-admin"),
  ejs = require("ejs"),  
  fs = require('fs'),
  multer  = require('multer'),  
  app = express(); 


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

const upload = multer({ storage: storage });

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
  };



firebase.initializeApp(firebaseConfig);

let db = firebase.firestore(); 




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
    res.send('your app is up and running');
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
END Gallery Page
**********************************************/

/*********************************************
Tour
**********************************************/

app.get('/privatetour/:sender_id/',function(req,res){
    const sender_id = req.params.sender_id;
    res.render('privatetour.ejs',{title:"Create Private Tour", sender_id:sender_id});
});

app.post('/privatetour',function(req,res){
      
      
      let destination= req.body.destination;
      let activities = req.body.activities;
      let guests = req.body.guests;
      let travel_mode = req.body.travel_mode;
      let travel_option = req.body.travel_option;
      let hotel = req.body.hotel;
      let restaurent= req.body.restaurent;
      let name  = req.body.name;
      let mobile = req.body.mobile;
      let sender = req.body.sender;  

     let booking_number = generateRandom(5);    

      db.collection('Pagodas Booking').add({
           
            destination:destination,
            activities:activities,
            guests:guests,
            travel_mode:travel_mode,
            travel_option:travel_option,
            hotel:hotel,
            restaurent:restaurent,            
            name:name,
            mobile:mobile,
            booking_number:booking_number,
          }).then(success => {             
             showBookingNumber(sender, booking_number);   
          }).catch(error => {
            console.log(error);
      });        
});


app.get('/updateprivatetour/:booking_number/:sender_id/',function(req,res){
    const sender_id = req.params.sender_id;
    const booking_number = req.params.booking_number;



    db.collection("Pagodas Booking").where("booking_number", "==", booking_number)
    .get()
    .then(function(querySnapshot) {
        querySnapshot.forEach(function(doc) {

            let data = {
              doc_id:doc.id,
              destination:doc.data().destination,
              activities:doc.data().activities,
              guests:doc.data().guests,
              travel_mode:doc.data().travel_mode,
              travel_option:doc.data().travel_option,
              hotel:doc.data().hotel,
              restaurent:doc.data().restaurent,            
              name:doc.data().name,
              mobile:doc.data().mobile,
              booking_number:doc.data().booking_number,
            }   

            console.log("BOOKING DATA", data);     

             res.render('updateprivatetour.ejs',{data:data, sender_id:sender_id});
            

        });
    })
    .catch(function(error) {
        console.log("Error getting documents: ", error);
    });    
});

app.post('/updateprivatetour',function(req,res){
      
      
      let destination= req.body.destination;
      let activities = req.body.activities;
      let guests = req.body.guests;
      let travel_mode = req.body.travel_mode;
      let travel_option = req.body.travel_option;
      let hotel = req.body.hotel;
      let restaurent= req.body.restaurent;
      let name  = req.body.name;
      let mobile = req.body.mobile;
      let sender = req.body.sender;
      let booking_number = req.body.booking_number; 
      let doc_id = req.body.doc_id;  

      db.collection('Pagodas Booking').doc(doc_id).update({           
            destination:destination,
            activities:activities,
            guests:guests,
            travel_mode:travel_mode,
            travel_option:travel_option,
            hotel:hotel,
            restaurent:restaurent,            
            name:name,
            mobile:mobile,
            booking_number:booking_number,
          }).then(success => {             
             showBookingNumber(sender, booking_number);   
          }).catch(error => {
            console.log(error);
      });        
});








app.get('/addpackage/:sender_id/',function(req,res){
    const sender_id = req.params.sender_id;
    res.render('addpackage.ejs',{title:"Hi!! from WebView", sender_id:sender_id});
});


app.post('/addpackage',function(req,res){      
      let image  = req.body.image; 
      let title = req.body.title;
      let description = req.body.description;   
      let sku = req.body.sku;   
      let sender = req.body.sender;   

      db.collection('package').add({
            image: image,
            title: title,
            description: description,
            sku:sku
            
          }).then(success => {             
             notifySave(sender);    
          }).catch(error => {
            console.log(error);
      });        
});


app.get('/booktour/:sku/:sender_id',function(req,res){
    const sku = req.params.sku;
    const sender_id = req.params.sender_id;


    

  
    const packages = {
      yangon:{
        title:"Yangon 2D1N",
        hotels:['Melia', 'Lotte', 'Sedona'],
        restaurents:['Fuji House', 'Koh Fu', 'Seeds']
      },
      mandalay:{
        title:"Mandalay 2D1N",
        hotels:['Yandanarbon', 'Apex', 'Golden Leaff'],
        restaurents:['Goldious', 'Mingalabar Myanmar', 'Unique']
      }

    }





    res.render('booktour.ejs',{title:"Book Tour Package", sender_id:sender_id, package:packages[sku]});
});


app.post('/booktour',function(req,res){
      let name  = req.body.name;
      let mobile = req.body.mobile;
      let tour_package = req.body.tour_package;
      let restaurent = req.body.restaurent;
      let hotel = req.body.hotel;
      let sender = req.body.sender;

      let booking_ref = generateRandom(5);   


      db.collection('Bookings').add({           
            name:name,
            mobile:mobile,
            restaurent:restaurent,
            hotel:hotel,
            ref:booking_ref,
            package:tour_package
          }).then(success => {             
             showBookingNumber(sender, booking_ref);    
          }).catch(error => {
            console.log(error);
      });        
});


/*********************************************
END Tour
**********************************************/


//webview test
app.get('/webview/:sender_id',function(req,res){
    const sender_id = req.params.sender_id;
    res.render('webview.ejs',{title:"Hello!! from WebView", sender_id:sender_id});
});

app.post('/webview',upload.single('file'),function(req,res){
       
      let name  = req.body.name;
      let email = req.body.email;
      let img_url = APP_URL + "/" + req.file.path;
      let sender = req.body.sender;    

      
      
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
  
  switch(received_message) {        
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

      console.log('USER MESSAGE', user_message);

      if(user_message.includes("Change Booking:")){
        let ref_num = user_message.slice(15);
        ref_num = ref_num.trim();
        updateBooking(sender_psid, ref_num);        
      }else{
          user_message = user_message.toLowerCase(); 

          switch(user_message) { 

        case "text":
          textReply(sender_psid);
          break;
        case "quick":
          quickReply(sender_psid);
          break;
        case "button":
          console.log('CASE: BUTTON');            
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
Function to handle when user click button
**********************************************/
const handlePostback = (sender_psid, received_postback) => {
  let payload = received_postback.payload;
  switch(payload) {        
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

/*********************************************
START TOUR
**********************************************/






const helloEagle = (sender_psid) => { 
    let response1 = {"text": "Do you want to change your itinerary?, (type 'update itinerary')"};
    let response2 = {"text": "Do you want to view packages? (type 'show packages')"};    
    callSend(sender_psid, response1).then(()=>{
      return callSend(sender_psid, response2);
    }); 
}

//to add tour packages by admin
function adminCreatePackage(sender_psid){
  let response;
  response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Create a tour package",                       
            "buttons": [              
              {
                "type": "web_url",
                "title": "create",
                "url":"https://fbstarter.herokuapp.com/addpackage/"+sender_psid,
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

//to show tour packages
const showTourPackages = (sender_psid) => {  

  db.collection('package').get()
  .then((snapshot) => {
    let elementItems = [];

    snapshot.forEach((doc) => {  
      var obj = {};
      //obj._id  = doc.id ;        
      obj.title = doc.data().title;       
      obj.image_url = doc.data().image;      
      obj.buttons = [{"type":"web_url", "title":"BOOK NOW", "url":"https://fbstarter.herokuapp.com/booktour/"+doc.data().sku+"/"+sender_psid, "webview_height_ratio": "full", "messenger_extensions": true,}]; 
      elementItems.push(obj);     
    });

    

    let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "image_aspect_ratio": "square",
          "elements": elementItems
        }
      }
    }    
    callSend(sender_psid, response);
  })
  .catch((err) => {
    console.log('Error getting documents', err);
  }); 
}


const privateTour = (sender_psid) => {
  let response;
  response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Create a tour package",                       
            "buttons": [              
              {
                "type": "web_url",
                "title": "create",
                "url":"https://fbstarter.herokuapp.com/privatetour/"+sender_psid,
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

const updateBooking = (sender_psid, ref_num) => {
    let response;
  response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "You are updating your booking number: " + ref_num,                       
            "buttons": [              
              {
                "type": "web_url",
                "title": "Update",
                "url":"https://fbstarter.herokuapp.com/updateprivatetour/"+ref_num+"/"+sender_psid,
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

const amendTour = (sender_psid) => { 
    let response = {
    "text": `Do you want to change hotel or restaurent?`,    
    };
    callSend(sender_psid, response); 
}

const askHotel = (sender_psid) => {  
  bot_q.askHotel = true;
  bot_q.askRestaurent = false;  
  let response = {
    "text": `Enter name of the hotel you want to stay`,    
    };
    callSend(sender_psid, response); 
}


const askRestaurent = (sender_psid) => {
  bot_q.askRestaurent = true;
  bot_q.askHotel = false;
  let response = {
    "text": `Enter name of the restaurent you want to go`,    
    };
    callSend(sender_psid, response); 
}

const askRef = (sender_psid) => {  
  bot_q.askRef = true;
 
  let response = {
    "text": `Please enter your booking reference number`,    
    };
    callSend(sender_psid, response); 
}

const updateItinerary = (sender_psid, ref) =>{
  
  let query =  db.collection('Bookings').where('ref', '==', ref).limit(1).get()
  .then(snapshot => {
    if (snapshot.empty) {
      console.log('No matching documents.');
      let response = {
        "text": `Unknown reference number`,    
      };
      callSend(sender_psid, response);
      return;
    } 

    const booking = snapshot.docs[0];


    
    if(user_input.hotel){
       booking.ref.update({hotel:user_input.hotel});
       notifySave(sender_psid); 
    }

    if(user_input.restaurent){
      booking.ref.update({restaurent:user_input.restaurent});
      notifySave(sender_psid);  
    }
  })
  .catch(err => {
    console.log('Error getting documents', err);
  });


  
     
}

const notifySave = (sender_psid) => { 
    let response = {
    "text": `Your data is saved`,    
    };
    callSend(sender_psid, response); 
}

const showBookingNumber = (sender_psid, ref) => { 
    let response = {
    "text": `Your data is saved. Please keep your booking reference ${ref}`,    
    };
    callSend(sender_psid, response); 
}



const generateRandom = (length) => {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}


/*********************************************
END TOUR
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
                "url":"https://fbstarter.herokuapp.com/showimages/"+sender_psid,
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
                "url":"https://fbstarter.herokuapp.com/webview/"+sender_psid,
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
                "url":"https://fbstarter.herokuapp.com/test/",
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
             "https://fbstarter.herokuapp.com" , 
             "https://herokuapp.com" ,
             'https://blife-messgerbot.herokuapp.com'                          
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