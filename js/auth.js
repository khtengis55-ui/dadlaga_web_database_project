import {supabase} from './supabase.js'

const authForm = document.getElementById('auth-form')
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const btnRegister = document.getElementById('btn-register')
const messageDiv = document.getElementById('message')


//шинээр бүртгүүлэх логик
btnRegister.addEventListener('click', async() => {
    console.log("Бүртгүүлэх товч дарагдлаа.")
    const email = emailInput.value
    const password = passwordInput.value

    if( !email || !password){
        showMessage("Имэйл болон нууц үгээ гүйцэл оруулна уу!", "text-danger")
        return
    }

    if(password.length < 6){
        showMessage("Нууц үг доод тал нь 6 тэмдэгт байх ёстой", "text-danger")
        return
    }

    const {data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
    })

    if(error){
        showMessage(`Бүртгэл амжилтгүй: ${error.message}`, "text-danger")
    }else{
        showMessage("Бүртгэл амжилттай! Та нэвтрэх товчийг дарж орно уу.", "text-success")
        passwordInput.value = ""
    }
})

//нэвтрэх логик
authForm.addEventListener('submit', async(e)=>{
    e.preventDefault()// Форм дарахад хуудас refresh хийгдэхээс сэргийлнэ

    const email = emailInput.value
    const password = passwordInput.value

    //Supabase руу нэвтрэх хүсэлт илгээх
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    })

    if(error){
        showMessage(`Нэвтрэх алдаа: ${error.message}`, "text-danger")
    }else{
        showMessage("Амжилттай нэвтэрлээ!", "text-success")

        setTimeout(()=>{
            window.location.href = 'dashboard.html'
        }, 1500)
    }
})

function showMessage( text, bootstrapColorClass){
    messageDiv.innerText = text
    messageDiv.className = `text-center small mt-3 fw-medium ${bootstrapColorClass}`
}