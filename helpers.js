const isBase64 = (str) => {
    if (str === '' || str.trim() === '') {
        return false
    }
    try {
        return btoa(atob(str)) == str
    } catch (err) {
        return false
    }
}

const isMedia = (attribute) => {
    const attributes = ['image', 'video', 'document']

    const isExists = attributes.find((item) => attribute.hasOwnProperty(item))
    if (isExists) {
        return true
    }

    return false
}

const keyExists = (key, keys) => {
    if (!keys.hasOwnProperty(key)) {
        throw key + 'not found'
    }

    return keys[key]
}

export { 
    isBase64, 
    isMedia, 
    keyExists 
}
