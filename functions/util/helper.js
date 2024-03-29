exports.isEmpty = (string) => {
    if (string.trim() === '') {
        return true;
    } else {
        return false;
    }
}

exports.isEmail = (email) => {
    const regExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (email.match(regExp)) {
        return true;
    } else {
        return false;
    }
}