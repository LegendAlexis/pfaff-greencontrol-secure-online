#pragma once
#include <Arduino.h>
#include "GCRelayBoard.h"
#include "GCInputService.h"
#include "GCCloudClient.h"
class GCSafetyController{public:void begin(GCRelayBoard&,GCInputService&);void update();void setTemperature(float);void applyCloudCommands(const GCCloudCommands&);private:void stopRoof();void stopWall();void moveRoof(bool);void moveWall(bool);void setWatering(bool);void setHeating(bool);GCRelayBoard*r_=nullptr;GCInputService*i_=nullptr;float t_=NAN;unsigned long rs_=0,ws_=0,last_=0;};
