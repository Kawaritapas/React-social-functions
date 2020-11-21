const functions = require('firebase-functions');
let express = require('express');
let app = express();
let bodyparser = require('body-parser');
app.use(bodyparser.urlencoded({extended:true}));
let { getScreams, createScream, getASingleScream, addComment, likeStream, unlikeScream, deleteScream } = require('./handlers/screams');
let { signup, login, uploadImage, addUserDetails, getUserDetails, userDetails, notificationIsRead } = require('./handlers/users');
let { isAuthenticated } = require('./util/middleware');
const { db } = require('./util/admin');
//scream routes
app.get('/screams', getScreams);
app.post('/create', isAuthenticated, createScream);
app.get('/scream/:screamId', getASingleScream);
app.delete('/scream/:screamId', isAuthenticated, deleteScream);
app.post('/scream/:screamId/comment', isAuthenticated, addComment);
app.get('/scream/:screamId/like', isAuthenticated, likeStream);
app.get('/scream/:screamId/unlike', isAuthenticated, unlikeScream);
//user routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', isAuthenticated, uploadImage);
app.post('/user/details', isAuthenticated, addUserDetails);
app.get('/details', isAuthenticated, getUserDetails);
app.get('/user/:handle', userDetails);
app.post('/notifications', isAuthenticated, notificationIsRead);


exports.api = functions.region('asia-south1').https.onRequest(app);

exports.createNotificationOnLike = functions
  .region('asia-south1')
  .firestore.document('likes/{id}')
  .onCreate((snapshot) => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'like',
            read: false,
            screamId: doc.id
          });
        }
      })
      .catch((err) => console.error(err));
  });


exports.createNotificationOnUnlike = functions
  .region('asia-south1')
  .firestore.document('likes/{id}')
  .onDelete((snapshot) => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch((err) => {
        console.error(err);
        return;
      });
  });


exports.createNotificationOnComment = functions
  .region('asia-south1')
  .firestore.document('comments/{id}')
  .onCreate((snapshot) => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'comment',
            read: false,
            screamId: doc.id
          });
        }
      })
      .catch((err) => {
        console.error(err);
        return;
      });
  });

exports.onUserImageChange = functions
  .region('asia-south1')
  .firestore.document('users/{userId}')
  .onUpdate(change => {
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      let batch = db.batch();
      return db.collection('screams').where('userHandle', '==', change.before.data().handle).get()
        .then(data => {
          data.forEach(doc => {
            let scream = db.doc(`/screams/${doc.id}`);
            batch.update(scream, { userImage: change.after.data().imageUrl });
          });
          return batch.commit();
        })
    }else return true;
  });

exports.onScreamDelete = functions
  .region('asia-south1')
  .firestore.document('screams/{screamId}')
  .onDelete((snapshot, context) => {
    let screamId = context.params.screamId;
    let batch = db.batch();
    return db.collection('comments').where('screamId', '==', screamId).get()
      .then(data => {
        data.forEach(doc => {
          let comments = db.doc(`/comments/${doc.id}`);
          batch.delete(comments);
        })
        return db.collection('likes').where('screamId', '==', screamId).get();
      })
      .then(data => {
        data.forEach(doc => {
          let likes = db.doc(`/likes/${doc.id}`);
          batch.delete(likes);
        })
        return db.collection('notifications').where('screamId', '==', screamId).get();
      })
      .then(data => {
        data.forEach(doc => {
          let notifications = db.doc(`/notifications/${doc.id}`);
          batch.delete(notifications);
        })
        return batch.commit();
      })
      .catch(err=>{
        console.error(err.code);
      })
  });