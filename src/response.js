const response = (res, code, data) => {
    res.status(code)
    res.json(data)
    res.end()
}

exports.response = response