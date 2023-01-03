import 'dotenv/config'
import response from './../response.js'

const validate = (req, res, next) => {

    let headers = req.headers;

    let key = process.env.API_KEY;

    if (key != undefined && headers["x-api-key"] == key) {
        next();
    } else {
        return response(res, 400, false, 'Unauthorized Request')
    }

}

export default validate