let { db, admin } = require('../util/admin');
db.settings({ ignoreUndefinedProperties: true })

exports.getScreams = (req, res) => {
    db.collection('screams').orderBy('createdAt', 'desc').get().then(data => {
        let screams = [];
        data.forEach(doc => {
            screams.push({
                screamId: doc.id,
                body: doc.data().body,
                userHandle: doc.data().userHandle,
                createdAt: doc.data().createdAt,
                userImage:doc.data().userImage
            });
        });
        return res.json(screams);
    })
        .catch(err => {
            console.error(err);
        });
};

exports.createScream = (req, res) => {
    const screamData = {
        body: req.body.body,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0
    };
    db.collection('screams').add(screamData)
        .then(doc => {
            let resScream = screamData;
            resScream.screamId = doc.id;
            return res.json(resScream);
        })
        .catch(err => {
            res.status(500).json({ error: `something went wrong` });
            console.error(err);
        });
};

exports.getASingleScream = (req, res) => {
    let screamData = {};
    console.log(`/screams/${req.params.screamId}`);
    db.doc(`/screams/${req.params.screamId}`).get().then(doc => {
        console.log(doc.data());
        if (doc.exists) {
            screamData = doc.data();
            screamData.screamId = doc.id;
            return db.collection('comments').where('screamId', '==', req.params.screamId).orderBy('createdAt', 'desc').get();
        } else {
            return res.status(404).json({ error: "this scream is not found" });
        }

    })
        .then(data => {
            screamData.comments = [];
            data.forEach(doc => {
                screamData.comments.push(doc.data());
            })
            return res.json(screamData);
        })
        .catch(err => {
            console.error(err.code);
            return res.status(500).json({ error: err.message });
        });
};

exports.deleteScream = (req, res) => {
    let document = db.doc(`screams/${req.params.screamId}`)
    document.get()
        .then(doc => {
            if (doc.exists) {
                if (req.user.handle == doc.data().userHandle) {
                    return document.delete();
                } else {
                    return res.status(400).json({ error: "this post doesnot belong to you" })
                }
            } else {
                return res.status(404).json({ error: "this document does not exist" });
            }
        })
        .then(()=>{
            return res.json({message:"scream deleted sucessfully"});
        })
        .catch(err => {
            console.error(err.message)
            return res.status(500).json({ error: err.message });
        });

}

exports.addComment = (req, res) => {
    if (req.body.body.trim() === '') {
        res.status(400).json({ error: "comment cannot be empty" });
    }
    let commentData = {
        body: req.body.body,
        createdAt: new Date().toISOString(),
        userHandle: req.user.handle,
        imageUrl: req.user.imageUrl,
        screamId: req.params.screamId
    }
    db.doc(`/screams/${req.params.screamId}`).get()
        .then(doc => {
            if (doc.exists) {
                return doc.ref.update({ commentCount: doc.data().commentCount + 1 })
                    .then(() => {
                        return db.collection('comments').add(commentData);
                    })
            } else {
                return res.status(404).json({ error: "the scream doesnot exist" });
            }
        })
        .then(() => {
            return res.json(commentData);
        })
        .catch(err => {
            res.status(500).json({ error: err.message });
        })
};
exports.likeStream = (req, res) => {
    let likeDocument = db.collection('likes').where('screamId', '==', req.params.screamId).where('userHandle', '==', req.user.handle).limit(1);

    let screamDocument = db.doc(`screams/${req.params.screamId}`);
    let screamData;
    screamDocument.get()
        .then(doc => {
            if (doc.exists) {
                screamData = doc.data();
                screamData.screamId = doc.id;
                return likeDocument.get();
            } else {
                return res.status(404).json({ error: "not found" });
            }
        })
        .then(data => {
            if (data.empty) {
                return db.collection('likes').add({
                    userHandle: req.user.handle,
                    screamId: req.params.screamId
                })
                    .then(() => {
                        screamData.likeCount++;
                        return screamDocument.update({ likeCount: screamData.likeCount });
                    })
                    .then(() => {
                        return res.json(screamData);
                    })
            } else {
                return res.status(400).json({ error: "you have already liked this scream" });
            }
        })
        .catch(err => {
            return res.status(500).json({ message: err.message });
        })

};

exports.unlikeScream = (req, res) => {
    let likeDocument = db.collection('likes').where('screamId', '==', req.params.screamId).where('userHandle', '==', req.user.handle).limit(1);
    let screamDocument = db.doc(`screams/${req.params.screamId}`);
    let screamData;
    screamDocument.get()
        .then(doc => {
            screamData = doc.data();
            screamData.screamId = doc.id;
            return likeDocument.get();
        })
        .then(data => {
            if (data.empty) {
                return res.status(400).json({ error: "scream not liked" });
            } else {
                return db.doc(`/likes/${data.docs[0].id}`).delete()
                    .then(() => {
                        screamData.likeCount--;
                        return screamDocument.update({ likeCount: screamData.likeCount });
                    })
                    .then(() => {
                        return res.json(screamData);
                    })
            }
        })
        .catch(err => {
            return res.status(500).json({ error: err.message });
        })
}