import axios from "axios"

const webhook = async (instance, type, data) => {
    if (process.env.WEBHOOK == 'true') {
        axios.post(process.env.WEBHOOK_URL, {
            headers: {
                'Content-Type': 'application/json'
            },
            data: data,
            type: type,
            instance: instance
        })
            .then(success => { return success })
            .catch(error => { console.log(error )  })
    }
}

export { webhook }