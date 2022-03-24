import { createWriteStream } from 'fs'
import axios from 'axios'

const downloadImage = async (url) => {
    const name = Math.floor(Date.now() / 1000)
    const filepath = './uploads/profile/' + name + '.jpg'

    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
    })

    return new Promise((resolve, reject) => {
        response.data
            .pipe(createWriteStream(filepath))
            .on('érror', reject)
            .once('close', () => {
                resolve(filepath)
            })
    })
}

export { downloadImage }
