# LittleReact
LittleReact说明：


前言：最近一直在看React源码，看了几天总有雾里观花之感；便想着自己从头写一遍，这几天基本上写了个大概了；

React的VirtualDOM,DOM diff,生命周期管理，单向数据流动等等都具备了；

当然也省略了非常多的细节和检查，事件系统和CallBackQuenue,PoolClass等都没有~（暂时DOM diff不太全，我再想想怎么写更好）；

不过这样足够理解React了，而且React剩下的部分看看就基本知道作用了；




那么言归正传：说一说我个人感觉其中比较难得地方和一些思路；（我使用的是React15.3版本）

首先：React现在已经非常庞大了，我当初本想多写几篇一点一点介绍的，不过我发现即使写了光看的话肯定看不明白的，最好的方法只能是自己写一遍；

第二点：必须要首先弄懂Transition事务模块；

Transition模块：现在React绝大部分模块都需要Transition触发的，这个是一个包裹函数，构造函数需原型继承Transaction，或原型方法逐个赋值。且getTransactionWrappers方法用于添加前置钩子与后置钩子；reinitializeTransaction方法在初始化时调用，用于清空前、后置钩子；perform方法实际执行method函数、及前后钩子。（看不懂可以去跑一跑我的Git上的示例）

第三点：ReactElement以及ReactComponent；传入的参数先转化为ReactElement，然后根据不同的node类型转换为不同的ReactComponent;

第四点:ReactComponent的递归渲染和ReactClass的原型混入传入的参数，在递归渲染时原型调用（这个我有些说不明白），我是调试React的运行过程，看了十来遍看明白的~~

第五点：纸上得来终觉浅，绝知此事要躬行~~


绝大部分代码都加上注释了，想自己写一写的可以参照一下；

最后附上我的参照资料，也深深感谢这两位作者：

http://purplebamboo.github.io/2015/09/15/reactjs_source_analyze_part_two/

http://schifred.iteye.com/category/368891
