import {    createClient    } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = "https://hxedaogfbxxtjmnvfguk.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZWRhb2dmYnh4dGptbnZmZ3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjQyMzAsImV4cCI6MjA5NjU0MDIzMH0.TW44-8Kgaj4shmaLXtFE8NZ91sUBGP2B0Tm-0C4bHio"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

if(supabase.auth){
    console.log("holbogodsn bn")
    console.log(supabase.auth)

}