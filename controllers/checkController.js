import { getSession, formatPhone ,isExists , ppUrl } from '../whatsapp.js'
import response from '../response.js'

const pp_Url = async (req, res) => {
    const session = getSession(res.locals.sessionId)

    const { phone } = req.params
    const phn_no = formatPhone(phone)

    try {
        const exists = await isExists(session, phn_no)

        if (!exists) {
            return response(res, 400, false, 'The whatsapp number is not exists.')
        }

        const img = await ppUrl(session, phn_no)

        if(img == false) {
            response(res, 404, false, 'Account Image not set')
        } else {
            response(res, 200, true, '' , { img })
        }



    } catch {
        response(res, 500, false, 'Failed to get image')
    }
}

const checkPhone = async (req, res) => {
    const session = getSession(res.locals.sessionId)

    const { phone } = req.params
    const phn_no = formatPhone(phone)


    const exists = await isExists(session, phn_no)

    if (!exists) {
        return response(res, 400, false, 'The whatsapp number is not exists.')
    } else {
        response(res, 200, true, 'Number found')
    }
}

export { 
    pp_Url,
    checkPhone,
 }
