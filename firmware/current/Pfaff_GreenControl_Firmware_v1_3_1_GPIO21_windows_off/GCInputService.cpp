#include "GCInputService.h"
#include "GCConfig.h"
void GCInputService::begin(){for(uint8_t p=4;p<=11;p++)pinMode(p,INPUT_PULLUP);Serial.println("DI1= Dach offen, DI2= Dach zu, DI3= Wand offen, DI4= Wand zu, DI5= Druck OK");}
void GCInputService::update(){}
bool GCInputService::active(uint8_t p)const{bool r=digitalRead(p);return GC_INPUT_ACTIVE_LOW?!r:r;}
bool GCInputService::roofOpen()const{return active(GC_DI_ROOF_OPEN);} bool GCInputService::roofClosed()const{return active(GC_DI_ROOF_CLOSED);} bool GCInputService::wallOpen()const{return active(GC_DI_WALL_OPEN);} bool GCInputService::wallClosed()const{return active(GC_DI_WALL_CLOSED);} bool GCInputService::pressureOk()const{return active(GC_DI_PRESSURE_OK);}
