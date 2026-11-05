#include "../mainboard/SafeStartup.h"
#include <cassert>
#include <cstdio>
#include <vector>
struct Event { char op; int pin; };
struct FakeIo {
  std::vector<Event> events;
  char fail=0;
  bool hiZ(uint8_t p) { events.push_back({'Z',p}); return fail!='Z'; }
  bool preloadLow(uint8_t p) { events.push_back({'L',p}); return fail!='L'; }
  bool output(uint8_t p) { events.push_back({'O',p}); return fail!='O'; }
};
int main() {
  using namespace codelab;
  const int expected[]={42,41,40,39,38,37,36,35,48,34,33,47,14,15,16,17,18,21,
    1,2,4,5,8,9,6,7,43,44,12,11,13,10,26,19,20,0,3,46,45};
  static_assert(board::validMap(), "Full unique pin map");
  for (size_t i=0;i<39;++i) assert(board::reserved[i]==expected[i]);
  assert(board::imuAddress==0x6A);
  assert(board::expansion[3]==board::uart1Tx && board::expansion[4]==board::uart1Rx);
  assert(board::expansion[5]==board::spiCs);
  const int straps[]={0,3,45,46};
  for (int i=0;i<4;++i) assert(board::strapping[i]==straps[i]);
  FakeIo io;
  SafeStartup s;
  assert(!s.initialized() && !s.armed() && !s.servoEnabled());
  assert(s.begin(io) && s.initialized());
  assert(io.events.size()==32); // 6 Hi-Z, 13 preload LOW, 13 OUTPUT.
  for (int i=0;i<6;++i) { assert(io.events[i].op=='Z'); assert(io.events[i].pin==expected[12+i]); }
  for (int i=0;i<13;++i) {
    const int pin=i==12 ? 26 : expected[i];
    assert(io.events[6+i].op=='L' && io.events[6+i].pin==pin);
    assert(io.events[19+i].op=='O' && io.events[19+i].pin==pin);
  }
  assert(s.begin(io) && io.events.size()==32 && !s.armed() && !s.servoEnabled());
  for (char fail : {'Z','L','O'}) {
    FakeIo bad; bad.fail=fail; SafeStartup state;
    assert(!state.begin(bad) && !state.initialized() && !state.armed() && !state.servoEnabled());
    const auto size=bad.events.size(); assert(!state.begin(bad) && bad.events.size()==size);
    if (fail!='O') for (auto e : bad.events) assert(e.op!='O');
  }
  std::puts("PASS: 39 GPIO mappings, aliases, straps, startup order/defaults, repeat and error paths");
}
