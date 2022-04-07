import axios from 'axios'

const webhook = async (instance, type, data) => {
    const host = process.env.APP_URL
    axios
        .post(`${host}/wahook/${type}`, {
            instance,
            type,
            data,
        })
        .then((success) => {
            return success
        })
        .catch((error) => {
            console.log(error)
            return error
        })
}

export { webhook }
