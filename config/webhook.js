import axios from "axios"

const webhook = async (instance, type, data) => {
    if (process.env.WEBHOOK == 'true') {
        axios.post(process.env.WEBHOOK_URL, {
            data: data,
            type: type,
            instance: instance
        })
            .then(success => { return success })
            .catch(error => { return error })
    }
}

export { webhook }