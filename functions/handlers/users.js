let { db, admin } = require('../util/admin');
let config = require('../util/config');
let firebase = require('firebase');
let { isEmpty, isEmail } = require('../util/helper');
const { user } = require('firebase-functions/lib/providers/auth');
firebase.initializeApp(config);
exports.signup = (req, res) => {
    const userInfo = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    }
    let errors = {};
    if (isEmpty(userInfo.email)) {
        errors.email = "the email field cannot be empty";
    }
    else if (!isEmail(userInfo.email)) {
        errors.email = "must be an email"
    }
    if (isEmpty(userInfo.password)) {
        errors.password = "password cannot be empty";
    }
    if (userInfo.password !== userInfo.confirmPassword) {
        errors.matchPassword = "password is not matching";
    }
    if (isEmpty(userInfo.handle)) {
        errors.handle = "handle cannot be empty";
    }
    if (Object.keys(errors).length > 0) {
        return res.status(400).json(errors)
    }
    const noImage = 'no-img.png';
    let token, userId;
    db.doc(`/users/${userInfo.handle}`).get().then(doc => {
        if (doc.exists) {
            return res.status(400).json({ email: `user already exists with email` });
        } else {
            return firebase.auth().createUserWithEmailAndPassword(userInfo.email, userInfo.password);
        }
    })
        .then(data => {
            userId = data.user.uid;
            return data.user.getIdToken();

        })
        .then(tokenid => {
            token = tokenid;
            let userCredentials = {
                handle: userInfo.handle,
                email: userInfo.email,
                createdAt: new Date().toISOString(),
                userId: userId,
                imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImage}?alt=media`
            }
            return db.doc(`/users/${userInfo.handle}`).set(userCredentials);
        }).then(() => {
            return res.status(201).json({ token });
        })
        .catch(err => {
            console.error(err);
            if (err.code == 'auth/email-already-in-use') {
                return res.status(400).json({ email: 'this email already exists' });
            } else {
                return res.status(500).json({general:"something went wrong" });
            }
        });

};

exports.login = (req, res) => {
    let userInfo = {
        email: req.body.email,
        password: req.body.password
    };
    let errors = {};
    if (isEmpty(userInfo.email)) {
        errors.email = "email cannot be empty";
    } else if (!isEmail(userInfo.email)) {
        errors.email = "invalid email";
    }
    if (isEmpty(userInfo.password)) {
        errors.password = "please enter your password";
    }
    if (Object.keys(errors).length > 0) {
        return res.status(400).json(errors);
    }

    firebase.auth().signInWithEmailAndPassword(userInfo.email, userInfo.password)
        .then(data => {
            return data.user.getIdToken();
        })
        .then(token => {
            return res.status(200).json({ token });
        })
        .catch(err => {
            console.error(err);
            if (err.code === 'auth/wrong-password') {
                return res.status(403).json({ error: "you have entered a wrong password" })
            } else {
                res.status(500).json({ error: err.code });
            }
        })
};

exports.uploadImage = (req, res) => {
    const BusBoy = require('busboy');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const busboy = new BusBoy({ headers: req.headers });
    let imageFileName;
    let imageToBeUploaded = {};
    busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
        if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
            return res.status(400).json({ error: "wrong file type" });
        };
        const imageExtension = filename.split('.')[filename.split('.').length - 1];
        imageFileName = `${Math.round(Math.random() * 10000000000)}.${imageExtension}`;
        const filepath = path.join(os.tmpdir(), imageFileName);
        console.log(filepath);
        imageToBeUploaded = {
            filepath: filepath,
            mimetype: mimetype
        };
        file.pipe(fs.createWriteStream(filepath));
    });
    busboy.on('finish', function () {
        admin.storage().bucket().upload(imageToBeUploaded.filepath, {
            resumable: false,
            metadata: {
                metadata: {
                    contentType: imageToBeUploaded.mimetype
                }
            }
        })
            .then(() => {
                const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imagefilename}?alt=media`;
                return db.doc(`/users/${req.user.handle}`).update({ imageUrl: imageUrl })
            })
            .then(() => {
                return res.status(200).json({ message: "image uploaded sucessfully" });
            })
            .catch(err => {
                return res.status(500).json({ error: err.code });
            })
    });
    busboy.end(req.rawBody);
};

exports.addUserDetails = (req, res) => {
    let addUserDetails = {};
    let bio = req.body.bio;
    let website = req.body.website;
    let location = req.body.location;
    if (!isEmpty(bio)) {
        addUserDetails.bio = req.body.bio;
    };
    if (!isEmpty(website.trim())) {
        addUserDetails.website = req.body.website;
        if (addUserDetails.website.trim().substring(0, 4) !== 'http') {
            addUserDetails.website = `http://${addUserDetails.website.trim()}`;
        } else {
            addUserDetails.website = website;
        }
    }
    if (!isEmpty(location.trim())) {
        addUserDetails.location = location;
    }

    db.doc(`/users/${req.user.handle}`).update(addUserDetails).then(() => {
        return res.status(200).json({ message: "user details upadted successfully" });
    })
        .catch(err => {
            return res.status(500).json({ error: err.message });
        })

};

exports.getUserDetails = (req, res) => {
    let userDetails = {};
    db.doc(`/users/${req.user.handle}`).get()
        .then(data => {
            if (data.exists) {
                userDetails.credentials = data.data();
            };
            return db.collection('likes').where('userHandle', '==', req.user.handle).get();
        })
        .then(data => {
            userDetails.likes = [];
            data.forEach(doc => {
                userDetails.likes.push(doc.data());
            });
            return db.collection('notifications').where('recipient', '==', req.user.handle).orderBy('createdAt', 'desc').limit(10).get();
        })
        .then(data => {
            userDetails.notifications = [];
            data.forEach(doc => {
                userDetails.notifications.push({
                    recipient: doc.data().recipient,
                    sender: doc.data().sender,
                    createdAt: doc.data().createdAt,
                    screamId: doc.data().screamId,
                    type: doc.data().type,
                    notificationId: doc.id,
                    read: doc.data().read
                });
            });
            return res.json(userDetails);
        })
        .catch(err => {
            res.status(500).json({ error: err.message });
        });
};

exports.notificationIsRead = (req, res) => {
    let batch = db.batch();
    req.body.forEach(notificationId => {
        let notification = db.doc(`notifications/${notificationId}`);
        batch.update(notification, { read: true });
    });
    batch.commit()
        .then(() => {
            return res.json({ message: "notifications are read" });
        })
        .catch(err => {
            return res.status(500).json({ error: err.message });
        });
};

exports.userDetails = (req, res) => {
    let userData = {};
    db.doc(`/users/${req.params.handle}`).get()
        .then(doc => {
            if (doc.exists) {
                userData.user = doc.data();
                return db.collection('screams').where('userHandle', '==', req.params.handle).orderBy('createdAt', 'desc').get();
            }
            else {
                return res.status(404).json({ error: "the user doesnt exist" })
            }
        })
        .then(data => {
            userData.screams = [];
            data.forEach(doc => {
                userData.screams.push({
                    body: doc.data().body,
                    createdAt: doc.data().createdAt,
                    likeCount: doc.data().likeCount,
                    commentCount: doc.data().commentCount,
                    userHandle: doc.data().userHandle,
                    userImage: doc.data().userImage,
                    screamId: doc.id
                });
            });
            return res.json(userData);
        })
        .catch(err => {
            return res.status(500).json({ error: err.message });
        });
};
