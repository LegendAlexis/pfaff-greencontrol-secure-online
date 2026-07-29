#pragma once
#include <Arduino.h>
struct GCDeviceState{float temperatureC=NAN;int wifiRssi=0;unsigned long uptimeSeconds=0;bool roofOpen=false,roofClosed=false,wallOpen=false,wallClosed=false,pressureOk=false,wateringOn=false,heatingOn=false;};
struct GCCloudCommands{bool valid=false,hasRoofTarget=false,roofTargetOpen=false,hasWallTarget=false,wallTargetOpen=false,hasWateringTarget=false,wateringTargetOn=false,hasHeatingTarget=false,heatingTargetOn=false;};
class GCCloudClient{public:bool sendHeartbeat(const GCDeviceState&,GCCloudCommands&);private:bool parseResponse(const String&,GCCloudCommands&);};
