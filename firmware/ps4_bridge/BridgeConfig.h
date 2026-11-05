#pragma once
// No final hardware pins are known. Override only after hardware review.
#ifndef CODELAB_BRIDGE_TX
#define CODELAB_BRIDGE_TX -1
#endif
#ifndef CODELAB_BRIDGE_RX
#define CODELAB_BRIDGE_RX -1
#endif
#ifndef CODELAB_BRIDGE_LED
#define CODELAB_BRIDGE_LED -1
#endif
constexpr int bridgeLed=CODELAB_BRIDGE_LED;
constexpr int bridgeTx=CODELAB_BRIDGE_TX,bridgeRx=CODELAB_BRIDGE_RX;
constexpr unsigned long bridgeBaud=115200;
constexpr bool bridgePinsAssigned=bridgeTx>=0 && bridgeRx>=0;
constexpr bool classicPin(int p){return (p>=0&&p<=5)||(p>=12&&p<=19)||(p>=21&&p<=23)||(p>=25&&p<=27)||(p>=32&&p<=39);}
static_assert(!bridgePinsAssigned||(classicPin(bridgeTx)&&classicPin(bridgeRx)&&bridgeTx<34&&bridgeTx!=bridgeRx&&bridgeTx!=1&&bridgeTx!=3&&bridgeRx!=1&&bridgeRx!=3),"Invalid Classic ESP32 UART pins/debug conflict");

static_assert(bridgeLed==-1||(classicPin(bridgeLed)&&bridgeLed<34&&bridgeLed!=1&&bridgeLed!=3&&bridgeLed!=bridgeTx&&bridgeLed!=bridgeRx),"Invalid bridge LED pin");
