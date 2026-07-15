import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function digest(value: string) { return createHash("sha256").update(value).digest(); }
function equalSecret(secret: string, hashHex: string) {
  const supplied=digest(secret); const stored=Buffer.from(hashHex,"hex");
  return supplied.length===stored.length && timingSafeEqual(supplied,stored);
}

export async function POST(request: NextRequest) {
  try {
    const deviceId=request.headers.get("x-device-id")?.trim();
    const deviceSecret=request.headers.get("x-device-secret")?.trim();
    if(!deviceId||!deviceSecret) return NextResponse.json({error:"Gerätezugang fehlt"},{status:401});

    const admin=createAdminClient();
    const {data:device,error}=await admin.from("devices").select("id,greenhouse_id,secret_hash,active").eq("id",deviceId).maybeSingle();
    if(error) throw error;
    if(!device?.active||!equalSecret(deviceSecret,device.secret_hash)) return NextResponse.json({error:"Gerät nicht autorisiert"},{status:401});

    const body=await request.json();
    const temperature=typeof body.temperature==="number"&&body.temperature>-50&&body.temperature<80?body.temperature:null;
    const status=typeof body.status==="string"?body.status.slice(0,40):"online";
    const now=new Date().toISOString();

    const {error:updateDeviceError}=await admin.from("devices").update({last_seen:now,firmware_version:typeof body.firmware_version==="string"?body.firmware_version.slice(0,40):null,updated_at:now}).eq("id",device.id);
    if(updateDeviceError) throw updateDeviceError;

    const {data:greenhouse,error:greenhouseError}=await admin.from("greenhouses").update({last_seen:now,temperature,status}).eq("id",device.greenhouse_id).select("id,auto_mode,roof_window_target,wall_window_target,watering_target,roof_manual_override,wall_manual_override,watering_manual_override").single();
    if(greenhouseError) throw greenhouseError;

    await admin.from("sensor_readings").insert({greenhouse_id:device.greenhouse_id,temperature,roof_window_open:body.roof_window_open??null,wall_window_open:body.wall_window_open??null,watering_on:body.watering_on??null,created_at:now});

    return NextResponse.json({ok:true,server_time:now,greenhouse_id:device.greenhouse_id,commands:{auto_mode:greenhouse.auto_mode,roof_window_target:greenhouse.roof_window_target,wall_window_target:greenhouse.wall_window_target,watering_target:temperature!==null&&temperature<=0?false:greenhouse.watering_target,roof_manual_override:greenhouse.roof_manual_override,wall_manual_override:greenhouse.wall_manual_override,watering_manual_override:greenhouse.watering_manual_override}});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Unbekannter Gerätefehler"},{status:500});
  }
}
