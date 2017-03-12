//空函数用于ReactClass原型继承及混入
var ReactClassComponent = function ReactClassComponent() { };
var emptyObject = {};
var ReactClass = {
    //创建自定义组件；creactClass是创建自定义组件的入口方法，负责管理生命周期中的getDefaultProps;
    //该方法在整个生命周期中只执行一次，这样所有实例初始化的props将会共享；
    createClass: function createClass(spec) {
        var Constructor = function (props, context, updater) {
            // 自动绑定
            if (this.__reactAutoBindPairs.length) {
                bindAutoBindMethods(this);
            }
            this.props = props;
            this.context = context;
            this.refs = emptyObject;
            this.updater = updater;
            // ReactClasses没有构造函数，通过getInitialState和componentWillMount来代替
            var initialState = this.getInitialState ? this.getInitialState() : null;
            this.state = initialState;
        };
        //原型继承父类
        Constructor.prototype = new ReactClassComponent();
        Constructor.prototype.constructor = Constructor;
        Constructor.prototype.__reactAutoBindPairs = [];
        //Constructor原型即ReactClassComponent渲染传入的方法以及React的API;
        var proto = Constructor.prototype;
        for (var name in spec) {
            var property = spec[name];
            proto[name] = property;
        }
        //渲染完原型API之后初始化getDefaultProps；(在整个生命周期中getDefaultProps只执行一次)；
        if (Constructor.getDefaultProps) {
            Constructor.defaultProps = Constructor.getDefaultProps();
        }
        for (var methodName in ReactClassInterface) {
            if (!Constructor.prototype[methodName]) {
                Constructor.prototype[methodName] = null;
            }
        }
        return Constructor;
    }
}
ReactClassComponent.prototype.setState = function (partialState) {
    var nextState = partialState;
    var inst = this;
    inst.state = extend(inst.state, nextState);
    var nextRenderedElement = inst.render();
    if (inst.componentWillUpdate) {
        inst.componentWillUpdate();
    }
    var internalInstance = inst._reactInternalInstance;
    var prevElement = internalInstance._currentElement;
    internalInstance._currentElement = nextRenderedElement;
    internalInstance.updateComponent(prevElement, nextRenderedElement);
    if (inst.componentDidUpdate) {
        inst.componentDidUpdate();
    }
}
var ReactInstanceMap = {
    //缓存渲染后的node
    remove: function remove(key) {
        key._reactInternalInstance = undefined;
    },

    get: function get(key) {
        return key._reactInternalInstance;
    },

    has: function has(key) {
        return key._reactInternalInstance !== undefined;
    },

    set: function set(key, value) {
        key._reactInternalInstance = value;
    }

};
//继承
var extend = function (target, source) {
    var from;
    var to = Object(target);
    var symbols;
    for (var s = 1; s < arguments.length; s++) {
        from = Object(arguments[s]);
        for (var key in from) {
            if (hasOwnProperty.call(from, key)) {
                to[key] = from[key];
            }
        }
        if (Object.getOwnPropertySymbols) {
            symbols = Object.getOwnPropertySymbols(from);
            for (var i = 0; i < symbols.length; i++) {
                if (propIsEnumerable.call(from, symbols[i])) {
                    to[symbols[i]] = from[symbols[i]];
                }
            }
        }
    }
    return to;
};
//React的批量更新策略即递归更新
var ReactUpdates = {
    /**
     * React references `ReactReconcileTransaction` using this property in order
     * to allow dependency injection.
     *
     * @internal
     */
    ReactReconcileTransaction: null,
    //callback batchedMountComponentIntoNode
    batchedUpdates: function (callback, a, b, c, d, e) {
        return ReactDefaultBatchingStrategy.batchedUpdates(callback, a, b, c, d, e);
    },
    enqueueUpdate: function () { },
    flushBatchedUpdates: function () { },
    injection: function () { },
    asap: function () { }
};
//Transaction模块用于实现，某构造函数的实例调用perform(method,args)方法时，在method函数执行前后调用特定钩子函数的功能。
//成对的前置钩子initialize函数和后置钩子close函数以数组形式添加，
//且前置钩子initialize函数用于向后置钩子close函数提供参数，在method函数前调用；
//后置钩子close在method函数后调用。

//构造函数需原型继承Transaction，或原型方法逐个赋值。且getTransactionWrappers方法用于添加前置钩子与后置钩子；
//reinitializeTransaction方法在初始化时调用，用于清空前、后置钩子；perform方法实际执行method函数、及前后钩子。

//React事件~就是将需要执行的方法用wrapper封装起来，再通过包装提供的perform方法执行；
//而在perform之前，先执行所有wrapper中的initiallize方法，执行完perform之后再执行所有的close的方法。一组initial及close方法称为一个wrapper；

//声明一个空对象~代表错误的状态~因为Transaction初始化数据返回不会是空对象；
var OBSERVED_ERROR = {};

var Transaction = {
    reinitializeTransaction: function reinitializeTransaction() {
        //初始化事件,根据调用对象不同，生成不同的transactionWrappers；并清空已有的钩子函数;
        this.transactionWrappers = this.getTransactionWrappers();
        if (this.wrapperInitData) {
            this.wrapperInitData.length = 0;
        } else {
            this.wrapperInitData = [];
        }
        this._isInTransaction = false;
    },

    _isInTransaction: false,

    getTransactionWrappers: null,

    isInTransaction: function isInTransaction() {
        return !!this._isInTransaction;
    },
    //true代表正在执行事件中
    perform: function perform(method, scope, a, b, c, d, e, f) {
        var errorThrown;
        var ret;
        try {
            this._isInTransaction = true;
            errorThrown = true;
            this.initializeAll(0);
            //调用传入的方法,其实我感觉ReactTransaction就是抽象出一层事件模型~根据调用对象初始化不同的数据~
            //优点一：优化JS固有的try catch如果事件出错的话transaction粒度更细;
            //优点二：解耦React的事件触发，根据不同对象传入不同transactionWrappers，然后调用不同的initial和close方法，不过通用一个事件处理过程; 
            ret = method.call(scope, a, b, c, d, e, f);
            errorThrown = false;
        } finally {
            try {
                if (errorThrown) {
                    try {
                        this.closeAll(0);
                    } catch (err) { }
                } else {
                    this.closeAll(0);
                }
            } finally {
                this._isInTransaction = false;
            }
        }
        return ret;
    },

    initializeAll: function initializeAll(startIndex) {
        var transactionWrappers = this.transactionWrappers;
        for (var i = startIndex; i < transactionWrappers.length; i++) {
            var wrapper = transactionWrappers[i];
            try {
                //虽然Wrappers初始化都是close方法和initialize方法；不过不同的 Wrappers传入的close方法和initialize方法是不同的
                // this.wrapperInitData[i]先复制为初始状态空对象代表错误，再调用wrapper.initialize.call(this)，如果Wrappers的
                //initialize方法需要初始化数据则进行，如果不需要则返回undefined，undefined是!=={}(空对象的即OBSERVED_ERROR)
                this.wrapperInitData[i] = OBSERVED_ERROR;
                this.wrapperInitData[i] = wrapper.initialize ? wrapper.initialize.call(this) : null;
            } finally {
                if (this.wrapperInitData[i] === OBSERVED_ERROR) {
                    // 到这一步代表wrapper初始化数据出错了~那么继续下一个，如果有err则停止初始化
                    try {
                        this.initializeAll(i + 1);
                    } catch (err) { }
                }
            }
        }
    },

    closeAll: function closeAll(startIndex) {
        var transactionWrappers = this.transactionWrappers;
        for (var i = startIndex; i < transactionWrappers.length; i++) {
            var wrapper = transactionWrappers[i];
            var initData = this.wrapperInitData[i];
            var errorThrown;
            try {
                errorThrown = true;
                if (initData !== OBSERVED_ERROR && wrapper.close) {
                    wrapper.close.call(this, initData);
                }
                errorThrown = false;
            } finally {
                if (errorThrown) {
                    try {
                        this.closeAll(i + 1);
                    } catch (e) { }
                }
            }
        }
        //把初始化的数据清空
        this.wrapperInitData.length = 0;
    }
};
//用来初始化的空函数
var emptyFunction = function emptyFunction() { };
var RESET_BATCHED_UPDATES = {
    initialize: emptyFunction,
    close: function close() {
        ReactDefaultBatchingStrategy.isBatchingUpdates = false;
    }
};
var FLUSH_BATCHED_UPDATES = {
    initialize: emptyFunction,
    // ReactUpdates.flushBatchedUpdates方法以特定钩子重绘dirtyComponents中的各组件    
    //    钩子包括ReactUpdatesFlushTransaction前后钩子，含组件重绘完成后的回调_pendingCallbacks    
    //    包括ReactReconcileTransaction前后钩子，含componentDidMount、componentDidUpdate回调 
    close: ReactUpdates.flushBatchedUpdates.bind(ReactUpdates)
};
function ReactDefaultBatchingStrategyTransition() {
    this.reinitializeTransaction();
}
var ReactDefaultBatchingStrategy = {
    isBatchingUpdates: false,
    batchedUpdates: function batchedUpdates(callback, a, b, c, d, e) {
        var alreadyBatchingUpdates = ReactDefaultBatchingStrategy.isBatchingUpdates;
        ReactDefaultBatchingStrategy.isBatchingUpdates = true;
        // 如果已经初始化过一次了则直接调用~否则transaction.perform方法还会在过程中初始化数据
        if (alreadyBatchingUpdates) {
            return callback(a, b, c, d, e);
        } else {
            return transaction.perform(callback, null, a, b, c, d, e);
        }
    },
};
// 首先我们要先混入事件系统的方法，包括初始化，close，perform等等；
extend(ReactDefaultBatchingStrategyTransition.prototype, Transaction, {
    //用于初始化transactionWrappers的方法
    getTransactionWrappers: function () {
        return [FLUSH_BATCHED_UPDATES, RESET_BATCHED_UPDATES];
    }
});
//初始化transaction会调用混入的reinitializeTransaction方法，然后返回[FLUSH_BATCHED_UPDATES, RESET_BATCHED_UPDATES]数组对应的initial和close方法；还会初始化数据；
var transaction = new ReactDefaultBatchingStrategyTransition();
//用来判定两个element需不需要更新
//这里的key是我们createElement的时候可以选择性的传入的。用来标识这个element，当发现key不同时，我们就可以直接重新渲染，不需要去更新了。
function shouldUpdateReactComponent(prevElement, nextElement) {
    var prevEmpty = prevElement === null || prevElement === false;
    var nextEmpty = nextElement === null || nextElement === false;
    var prevType = typeof prevElement;
    var nextType = typeof nextElement;
    if (prevEmpty || nextEmpty) {
        return prevEmpty === nextEmpty;
    }
    if (prevType === 'string' || prevType === 'number') {
        return nextType === 'string' || nextType === 'number';
    } else {
        return nextType === 'object' && prevElement.type === nextElement.type && prevElement.key === nextElement.key;
    }
}

var LittleReact = {
    nextReactRootIndex: 0,
    createClass: ReactClass.createClass,
    render: function (nextElement, container, callback) {
        //React之中是需要先包裹一下，我把这个去了； 这个包裹是对reactElement进行一个元素包裹；在React之前的版本中需要根据传入的node是DOM还是字符串，区分为ReactDOMComponent或ReactDOMTextComponent
        //或ReactCompositeComponent；用这个临时的TopLevelWrapper函数包裹所有的属性，这样就不必在这判断node的类型了；
        //var nextWrappedElement = LittleReactElement(TopLevelWrapper, null, null, null, null, null, nextElement);
        var nextContext = {};
        //if (parentComponent) {
        //    var parentInst = ReactInstanceMap.get(parentComponent);
        //    nextContext = parentInst._processChildContext(parentInst._context);
        //} else {
        //    nextContext;//emptyObject;
        //}
        var containerHasReactMarkup;//是否有渲染过的reactElement
        var containerHasNonRootReactChild;//是否有子节点；
        //获取容器的子元素;
        var reactRootElement;
        //nodeType为9代表是Document
        if (container.nodeType === 9) {
            reactRootElement = container.documentElement;
        } else {
            reactRootElement = container ? container.firstChild : null;
        }
        //如果容器此前拥有过react子节点则需要找到它，然后进行DOMdiff比较；
        var prevComponent = getClosestInstanceFromNode(reactRootElement);
        if (prevComponent) {
            //获取容器子节点上次渲染的的ReactElement元素
            var prevElement = prevComponent._currentElement;
            //检查是不是同一个类型的node；
            var shouldUpdate = shouldUpdateReactComponent(prevElement, nextElement);
            if (shouldUpdate) {
                //脏检查;
                var dirtyComponents = [];
                var updateNumber = 0;
                var domDiff;
                var publicInst = prevComponent._hostNode;
                //给先前节点赋上当前需要渲染的元素，开始脏检查；
                prevComponent._pendingElement = nextElement;
                if (prevComponent._updateNumber == null) {
                    prevComponent._updateNumber = updateNumber + 1;
                }
                var prevChildren = prevComponent._renderedChildren;
                var nextChildren = nextElement.props.children;
                var name;
                var prevChild;
                //ReactDOMComponent的_updateChildren方法；
                for (name in nextChildren) {
                    prevChild = prevChildren && prevChildren[name];//保存之前渲染的节点包含相同名字(即顺序相同的子节点)；
                    var difPrevElement = prevChild && prevChild._currentElement;
                    var difNextElement = nextChildren[name];
                    if (prevChild != null && shouldUpdateReactComponent(difPrevElement, difNextElement)) {
                        if (difPrevElement.key === difPrevElement.key) {
                            nextChildren[name] = prevChild;//二者相同则直接采用之前渲染的node;
                        }
                    } else {//不同则需要渲染这个节点；
                        var nextChildInstance = new instantiateReactComponent(difNextElement);
                        nextChildren[name] = nextChildInstance;
                    }
                }
                if (Array.isArray(nextChildren)) {
                    for (var i = 0; i < nextChildren.length; i++) {
                        nextChildren[i].mountComponent(prevComponent._hostNode, null, null, prevComponent._hostNode.ownerDocument);
                    }
                    return;
                }
            }
        }
        else {
            containerHasNonRootReactChild = false;
        }

        if (reactRootElement) {
            containerHasReactMarkup = !!reactRootElement.getAttribute && !!reactRootElement.getAttribute('"data-reactid"');
        }
        //是否需要重新渲染？
        var shouldReuseMarkup = containerHasReactMarkup && !prevComponent && !containerHasNonRootReactChild;
        //var component = ReactMount._renderNewRootComponent(nextWrappedElement, container, shouldReuseMarkup, nextContext)._renderedComponent.getPublicInstance();

        //当使用React创建组件时，首先会调用instantiateReactComponent，这是初始化组件的入口函数
        //它根据判断node类型来区分不同组件的入口
        var componentInstance = instantiateReactComponent(nextElement);
        ReactInstanceMap.set(componentInstance, this);
        //获取容器的标签和doc用于创建DOM标签;
        var tag = container ? container.nodeName.toLowerCase() : null;
        var _ownerDocument = container ? container.nodeType === 9 ? container : container.ownerDocument : null
        ReactUpdates.batchedUpdates(performInitialMount, componentInstance, container, tag, _ownerDocument);
    }
}


//type是dom标签如p，div等或者是自定义组件；props是标签的属性如id，onclick方法等；Children就是是否有子节点，比如标签下的文本就算子节点；
LittleReact.createElement = function (type, config, children) {
    //type是string的话就代表是普通DOM标签，如果是function则代表是自定义的组件；
    var validType = typeof type === 'string' || typeof type === 'function';
    var propName;
    var props = {};

    var key = null;
    var ref = null;
    var self = null;
    var source = null;
    //ref用于父组件引用子组件的真实DOM，key用于调和算法，判断该组件是否update或remove 这个比较高级可稍后再议
    if (config) {
        ref = config.ref;
        key = config.key;
        //RESERVED_PROPS为_source, self,key,ref的一个枚举，此方法的作用是让props复制除_source, self,key,ref之外的其它属性；
        for (propName in config) {
            if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                props[propName] = config[propName];
            }
        }
    }
    //处理children,全部挂载到props的Children属性上，如果只有一个子元素则直接赋值；
    //这个arguments.length - 2；如果不太明白可以看ReactDOM.render(UL, document.getElementById('content'))这个示例;
    var childrenLength = arguments.length - 2;
    if (childrenLength === 1) {
        props.children = children;
    } else if (childrenLength > 1) {
        var childArray = Array(childrenLength);
        for (var i = 0; i < childrenLength; i++) {
            childArray[i] = arguments[i + 2];
        }
        props.children = childArray;
    }
    //如果某个prop为空且存在默认的prop，则将默认prop赋给当前prop；
    if (type && type.defaultProps) {
        var defaultProps = type.defaultProps;
        for (propName in defaultProps) {
            if (props[propName] === undefined) {
                props[propName] = defaultProps[propName];
            }
        }
    }
    return LittleReactElement(type, key, ref, self, source, null, props);
    //这里react还需要验证子元素是否正确以及props属性是否正确,我们先略过；
}
var LittleReactElement = function (type, key, ref, self, source, owner, props) {
    var element = {
        $$typeof: 'Symbol(react.element)',//一个标识； 判断是React生成的元素还是dom自带的元素
        type: type,
        key: key,
        ref: ref,
        props: props,
        _owner: owner
    }
    //react这部分有一个生成一个元素备份的方法，并定义了几个属性，然后把element密封，我们先去掉这些细节；
    return element;
}


//render方法里面的方法
//node元素标识
var internalInstanceKey = '__littleReactInstance$' + Math.random().toString(36).slice(2);
//标识顺序，用于递归渲染；
var topLevelRootCounter = 1;
var TopLevelWrapper = function () {
    this.rootID = topLevelRootCounter++;
}
//递归渲染节点时调用render方法；
TopLevelWrapper.prototype.render = function () {
    return this.props;
};

//容器如果之前曾渲染过Reat组件，则根据缓存的标识internalInstanceKey返回该组件
function getClosestInstanceFromNode(node) {
    if (!node) {
        return null;
    }
    //传入一个DOM node 返回ReactDOMComponent 或 ReactDOMTextComponent实例，如果不是ReactElement则返回null
    if (node[internalInstanceKey]) {
        return node[internalInstanceKey];
    }
    var parents = [];
    while (!node[internalInstanceKey]) {
        parents.push(node);
        if (node.parentNode)
            node = node.parentNode;
        else
            return null;
    }
}

//创建ReactComponent的工厂模式~根据传入node返回不同组件；
function instantiateReactComponent(node) {
    var instance;
    //当node类型为对象时，即是DOM标签或者自定义组件，如果element类型为字符串时，则初始化DOM标签组件，否则初始化自定义组件；
    if (typeof node === 'object') {
        if (typeof node.type === 'string') {
            instance = new ReactDOMComponent(node);
        }
        else {
            var isInternalComponentType = typeof type === 'function' && typeof type.prototype !== 'undefined' && typeof type.prototype.mountComponent === 'function' && typeof type.prototype.receiveComponent === 'function';
            if (!isInternalComponentType) {
                //自定义组件
                instance = new ReactCompositeComponent(node);
            } else {
                //不是字符串表示的自定义组件暂时无法使用，此后将不做组件初始化操作;

            }

        }
    }
    else if (typeof node === 'string' || typeof node === 'number') {
        //字符串或数字(ReactTextComponent)在执行mountComponent方法时，ReactDOMTextComponent通过transition.useCreateElement判断该文本是否是通过createElement
        //方法创建的节点；如果是则为该节点创建相应的标签和标识domID；这样每个文本节点也拥有了自己的唯一标识也拥有了Virtual DOM diff的权利；
        instance = new ReactDOMTextComponent(node);
    }
    else if (node === null || node === false) {
        instance = ReactEmptyComponent.create(instantiateReactComponent);
    }
    //初始化参数
    instance._mountIndex = 0;
    instance._mountImage = null;
    return instance;
}



var ReactCompositeComponent = function (element) {
    // ReactComponentElement，配置了组件的构造函数、props属性等
    this._currentElement = element;
    this._rootNodeID = 0;
    //区分纯函数无状态组件、继承自PureComponent的纯组件、以及继承自Component的组件
    this._compositeType = null;
    this._instance = null;// ReactComponent实例
    this._hostParent = null;// 文档元素，作为组件元素的父节点
    this._hostContainerInfo = null;
    this._updateBatchNumber = null;
    this._pendingElement = null;// ReactDom.render方法渲染时包裹元素由react组件渲染，_pendingElement存储待渲染元素 
    this._pendingStateQueue = null;// 组件调用setState、replaceState方法，通过ReactUpdateQueue将更迭后的state推入_pendingStateQueue  
    this._pendingReplaceState = false;// 判断组件是否通过调用replaceState方法向_pendingStateQueue推入state数据  
    this._pendingForceUpdate = false;// 组件调用forceUpdate赋值为真 
    this._renderedNodeType = null;// 节点类型，区分ReactComponentElement、ReactDomElement元素
    this._renderedComponent = null;// 子组件的ReactComponent实例 
    this._context = null;// 赋值给组件的context属性
    this._mountOrder = 0;// 挂载的第几个组件  
    this._topLevelWrapper = null;
    this._pendingCallbacks = null;
    this._calledComponentWillUnmount = false;
}
ReactCompositeComponent.prototype.displayName = 'ReactCompositeComponent';
ReactCompositeComponent.prototype.mountComponent = function (hostParent, hostContainerInfo, tag, ownerDocument) {
    return performInitialMount(this, hostParent, tag, ownerDocument);
}



//mountComponent附则管理生命周期中的getInitialState,componentWillMount,render和componentDidMount
//初始化组件，渲染标记，注册监听事件
var nextMountID = 1;
function FactoryMountComponent(internalInstance, hostContainerInfo, tag, ownerDocument) {
    var hostParent;
    //var internalInstance;
    //if (child.$$typeof) {
    //    internalInstance
    //}
    //调用组件对应原型的渲染方法；
    if (internalInstance.displayName === 'ReactCompositeComponent') {
        var markup = internalInstance.mountComponent(internalInstance, hostContainerInfo, tag, ownerDocument);
    }
    var markup = internalInstance.mountComponent(hostParent, hostContainerInfo, tag, ownerDocument);
    return markup;
}

//进行递归渲染，每次都获得当前节点的子节点，根据子节点的不同类型调用相应的渲染方法；
function performInitialMount(componentInstance, hostContainerInfo, tag, ownerDocument) {
    var props = componentInstance._currentElement.props;
    var displayName = componentInstance.displayName;
    var Component = componentInstance._currentElement.type;
    var child;
    var inst;

    //如果拥有子组件则找到它，目的是先渲染子组件；
    if (displayName == 'ReactCompositeComponent') {
        inst = new Component(props, null, null);
        
        child = inst.render();
        child = instantiateReactComponent(child);
        inst._reactInternalInstance = child;
        //存储constructor，用于回调绑定的函数
        child._constructor = inst;
        tag = child._tag;
    }
    else {
        inst = function () { };
        //如果是ReactDOMComponent则直接调用其原型渲染方法；
        child = componentInstance;
    }
    //得到currentElement子节点对应的Component类实例；
    //保存子节点的实例，用于循环递归到最底层然后从最底层开始渲染；比如ReactDOMComponentTree的precacheNode方法；
    this._renderedComponent = child;
    //如果存在componentWillMount则调用；
    if (inst.componentWillMount) {
        inst.componentWillMount();
        // componentWillMount调用setState时，不会触发re-render而是自动提前合并；
        if (this._pendingStateQueue) {
            inst.state = this._processPendingState(inst.props, inst.context);
        }
    }
    //递归渲染
    var markup = FactoryMountComponent(child, hostContainerInfo, tag, ownerDocument);
    //如果存在componentDidMount则调用；
    if (inst.componentDidMount) {
        inst.componentDidMount();
    }
    var identify = false;
    if (child._containerInfo) {
        identify = true;
    }
    mountNodesToContainer(markup, hostContainerInfo, identify);
}

//最后一步~把渲染后的Node添加进容器；
function mountNodesToContainer(markup, container, identify) {
    if (identify) {
        container.appendChild(markup.node);
    } else {
        while (container.lastChild) {
            container.removeChild(container.lastChild);
        }
        container.insertBefore(markup.node, null);
    }

}

var ReactDOMComponent = function (element) {
    var tag = element.type;
    this._currentElement = element;
    this._tag = tag.toLowerCase();
    this._namespaceURI = null;
    this._renderedChildren = [];//存放渲染后的子节点，如果节点更改，进行DOMdiff比较；
    this._previousStyle = null;
    this._previousStyleCopy = null;
    this._hostNode = null;
    this._hostParent = null;
    this._rootNodeID = 0;
    this._domID = 0;
    this._hostContainerInfo = null;
    this._wrapperState = null;
    this._topLevelWrapper = null;
    this._flags = 0;
}
var _idCounter = 1;
ReactDOMComponent.prototype.displayName = 'ReactDOMComponent';
ReactDOMComponent.prototype.mountComponent = function (hostParent, container, tag, ownerDocument) {
    this._domID = _idCounter++;
    this._containerInfo = container;
    this._hostParent = hostParent;//是否有React父组件；
    var props = this._currentElement.props;

    switch (tag) {
        case 'audio':
        case 'form':
        case 'iframe':
        case 'img':
        case 'link':
        case 'object':
        case 'source':
        case 'video':
            this._wrapperState = {
                listeners: null
            };
            transaction.getReactMountReady().enqueue(trapBubbledEventsLocal, this);
            break;
        case 'button':
            props = ReactDOMButton.getHostProps(this, props, hostParent);
            break;
        case 'input':
            ReactDOMInput.mountWrapper(this, props, hostParent);
            props = ReactDOMInput.getHostProps(this, props);
            transaction.getReactMountReady().enqueue(trapBubbledEventsLocal, this);
            break;
        case 'option':
            ReactDOMOption.mountWrapper(this, props, hostParent);
            props = ReactDOMOption.getHostProps(this, props);
            break;
        case 'select':
            ReactDOMSelect.mountWrapper(this, props, hostParent);
            props = ReactDOMSelect.getHostProps(this, props);
            transaction.getReactMountReady().enqueue(trapBubbledEventsLocal, this);
            break;
        case 'textarea':
            ReactDOMTextarea.mountWrapper(this, props, hostParent);
            props = ReactDOMTextarea.getHostProps(this, props);
            transaction.getReactMountReady().enqueue(trapBubbledEventsLocal, this);
            break;
    }

    // We create tags in the namespace of their parent container, except HTML
    // tags get no namespace.
    var namespaceURI;
    var parentTag;
    if (hostParent != null) {
        namespaceURI = hostParent._namespaceURI;
        parentTag = hostParent._tag;
    } else if (tag) {
        namespaceURI = container.namespaceURI;
        parentTag = tag;
    }
    this._namespaceURI = namespaceURI;
    var mountImage;
    if (container) {//?~暂未确定
        var el;
        if (namespaceURI) {
            if (this._tag === 'script') {
                // Create the script via .innerHTML so its "parser-inserted" flag is
                // set to true and it does not execute
                var div = ownerDocument.createElement('div');
                var type = this._currentElement.type;
                div.innerHTML = '<' + type + '></' + type + '>';
                el = div.removeChild(div.firstChild);
            } else if (props.is) {
                el = ownerDocument.createElement(this._currentElement.type, props.is);
            } else {
                // Separate else branch instead of using `props.is || undefined` above becuase of a Firefox bug.
                // See discussion in https://github.com/facebook/react/pull/6896
                // and discussion in https://bugzilla.mozilla.org/show_bug.cgi?id=1276240
                el = ownerDocument.createElement(this._currentElement.type);
            }
        } else {
            el = ownerDocument.createElement(this._currentElement.type);
            //el = ownerDocument.createElementNS(namespaceURI, this._currentElement.type);
        }

        ReactDOMComponentTree.precacheNode(this, el);
        //this._flags |= Flags.hasCachedChildNodes;
        if (!this._containerInfo) {
            el.setAttribute('data-reactroot', '');
        }
        var child;//如果有子节点
        var nextName;//如果有子节点,子节点名称

        //把属性赋上去；
        this.updateDOMProperties(null, props, transaction);
        var lazyTree = DOMLazyTree(el);
        if (typeof props.children === 'string' || typeof props.children === 'number') {
            var firstChild = lazyTree.node.firstChild;
            if (firstChild && firstChild === node.lastChild && firstChild.nodeType === 3) {
                firstChild.nodeValue = props.children;
                return;
            }
            lazyTree.node.textContent = props.children;
            this._renderedComponent = lazyTree.node;
        }
        else if (Array.isArray(props.children)) {//有未渲染的子元素
            var children = props.children;
            for (var i = 0; i < children.length; i++) {
                child = new instantiateReactComponent(children[i]);
                child._constructor = this._constructor;
                this._renderedChildren.push(child);//保存渲染后的子节点；用于DOM diff比较;
                nextName = "." + i.toString(36);
                child.mountComponent(lazyTree.node, container, null, ownerDocument);
            }
        }
        if (hostParent) {
            hostParent.appendChild(lazyTree.node);
        }
        mountImage = lazyTree;
    } else {
        var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);
        var tagContent = this._createContentMarkup(transaction, props, context);
        if (!tagContent && omittedCloseTags[this._tag]) {
            mountImage = tagOpen + '/>';
        } else {
            mountImage = tagOpen + '>' + tagContent + '</' + this._currentElement.type + '>';
        }
    }

    switch (tag) {
        case 'input':
            transaction.getReactMountReady().enqueue(inputPostMount, this);
            if (props.autoFocus) {
                transaction.getReactMountReady().enqueue(AutoFocusUtils.focusDOMComponent, this);
            }
            break;
        case 'textarea':
            transaction.getReactMountReady().enqueue(textareaPostMount, this);
            if (props.autoFocus) {
                transaction.getReactMountReady().enqueue(AutoFocusUtils.focusDOMComponent, this);
            }
            break;
        case 'select':
            if (props.autoFocus) {
                transaction.getReactMountReady().enqueue(AutoFocusUtils.focusDOMComponent, this);
            }
            break;
        case 'button':
            if (props.autoFocus) {
                transaction.getReactMountReady().enqueue(AutoFocusUtils.focusDOMComponent, this);
            }
            break;
        case 'option':
            transaction.getReactMountReady().enqueue(optionPostMount, this);
            break;
    }

    return mountImage;
}
ReactDOMComponent.prototype.updateDOMProperties = function (lastProps, nextProps, transaction) {
    var propKey;
    var styleName;
    var styleUpdates;
    for (propKey in lastProps) {
        if (nextProps.hasOwnProperty(propKey) || !lastProps.hasOwnProperty(propKey) || lastProps[propKey] == null) {
            continue;
        }
        if (propKey === "style") {
            var lastStyle = this._previousStyleCopy;
            for (styleName in lastStyle) {
                if (lastStyle.hasOwnProperty(styleName)) {
                    styleUpdates = styleUpdates || {};
                    styleUpdates[styleName] = '';
                }
            }
            this._previousStyleCopy = null;
        } else if (registrationNameModules.hasOwnProperty(propKey)) {
            if (lastProps[propKey]) {
                // Only call deleteListener if there was a listener previously or
                // else willDeleteListener gets called when there wasn't actually a
                // listener (e.g., onClick={null})
                deleteListener(this, propKey);
            }
        } else if (isCustomComponent(this._tag, lastProps)) {
            if (!RESERVED_PROPS.hasOwnProperty(propKey)) {
                DOMPropertyOperations.deleteValueForAttribute(getNode(this), propKey);
            }
        } else if (DOMProperty.properties[propKey] || DOMProperty.isCustomAttribute(propKey)) {
            DOMPropertyOperations.deleteValueForProperty(getNode(this), propKey);
        }
    }
    for (propKey in nextProps) {
        var nextProp = nextProps[propKey];
        var lastProp = propKey === "style" ? this._previousStyleCopy : lastProps != null ? lastProps[propKey] : undefined;
        if (!nextProps.hasOwnProperty(propKey) || nextProp === lastProp || nextProp == null && lastProp == null) {
            continue;
        }
        if (propKey === "style") {
            if (nextProp) {
                if ("development" !== 'production') {
                    checkAndWarnForMutatedStyle(this._previousStyleCopy, this._previousStyle, this);
                    this._previousStyle = nextProp;
                }
                nextProp = this._previousStyleCopy = _assign({}, nextProp);
            } else {
                this._previousStyleCopy = null;
            }
            if (lastProp) {
                // Unset styles on `lastProp` but not on `nextProp`.
                for (styleName in lastProp) {
                    if (lastProp.hasOwnProperty(styleName) && (!nextProp || !nextProp.hasOwnProperty(styleName))) {
                        styleUpdates = styleUpdates || {};
                        styleUpdates[styleName] = '';
                    }
                }
                // Update styles that changed since `lastProp`.
                for (styleName in nextProp) {
                    if (nextProp.hasOwnProperty(styleName) && lastProp[styleName] !== nextProp[styleName]) {
                        styleUpdates = styleUpdates || {};
                        styleUpdates[styleName] = nextProp[styleName];
                    }
                }
            } else {
                // Relies on `updateStylesByID` not mutating `styleUpdates`.
                styleUpdates = nextProp;
            }
        }
        else if (typeof nextProp==='function') {//如果是事件则添加event
            if (nextProp&&this._constructor) {
                var eventType = propKey.replace('on', '').toLowerCase();
                //绑定作用域
                nextProp=nextProp.bind(this._constructor);
                EventListener.listen(this._hostNode, eventType, nextProp);//EventListener.dispatchEvent
            } else if (lastProp) {
                deleteListener(this, propKey);
            }
        }
            //else if (isCustomComponent(this._tag, nextProps)) {
            //    if (!RESERVED_PROPS.hasOwnProperty(propKey)) {
            //        DOMPropertyOperations.setValueForAttribute(getNode(this), propKey, nextProp);
            //    }}
        else if (typeof nextProps[propKey] === 'string') {
            var node;
            if (this._hostNode) {//取出我们在precacheNode方法中保存的父节点;
                node = this._hostNode;
            }
            // 把传入的props赋给节点；
            if (propKey != null&&propKey!=='children') {
                node.setAttribute(propKey, '' + nextProps[propKey]);
            } else {
                //DOMPropertyOperations.deleteValueForProperty(node, propKey);
            }
        }
    }
    if (styleUpdates) {
        CSSPropertyOperations.setValueForStyles(getNode(this), styleUpdates, this);
    }
}
ReactDOMComponent.prototype.updateComponent = function (prevElement, nextElement) {
    var lastProps = prevElement.props;
    var nextProps = this._currentElement.props;
    this.updateDOMProperties(lastProps, nextProps, transaction);
    if (typeof nextProps.children === 'string' || typeof nextProps.children === 'number') {
        var firstChild = this._hostNode.firstChild;
        if (firstChild && firstChild === this._hostNode.lastChild && firstChild.nodeType === 3) {
            firstChild.nodeValue = nextProps.children;
            //return;
        }
        this._hostNode.textContent = nextProps.children;
    }
    //this._updateDOMChildren(lastProps, nextProps, transaction, context);
}
var ReactDOMComponentTree = {
    getClosestInstanceFromNode: '',
    getInstanceFromNode: '',
    getNodeFromInstance: '',
    precacheChildNodes: function (inst, node) {
    },
    precacheNode: function (inst, node) {
        var rendered;
        while (rendered = inst._renderedComponent) {
            inst = rendered;
        }
        inst._hostNode = node;
        node[internalInstanceKey] = inst;
    },
    uncacheNode: ''
};
function DOMLazyTree(node) {
    return {
        node: node,
        children: [],
        html: null,
        text: null,
        toString: toString
    };
}
var ReactDOMTextComponent = function (text) {
    this._currentElement = text;
    this._stringText = '' + text;
    // ReactDOMComponentTree uses these:
    this._hostNode = null;
    this._hostParent = null;
    // Properties
    this._domID = 0;
    this._mountIndex = 0;
    this._closingComment = null;
    this._commentNodes = null;
}
ReactDOMTextComponent.prototype.displayName = 'ReactDOMTextComponent';
ReactDOMTextComponent.prototype.mountComponent = function (hostParent, container, tag, ownerDocument) {
    var domID = _idCounter++;
    var openingValue = ' react-text: ' + domID + ' ';
    var closingValue = ' /react-text ';
    this._domID = domID;
    this._hostParent = hostParent;
    var openingComment = ownerDocument.createComment(openingValue);
    var closingComment = ownerDocument.createComment(closingValue);
    var lazyTree = DOMLazyTree(ownerDocument.createDocumentFragment());
    lazyTree.node.appendChild(openingComment);
    if (this._stringText) {
        lazyTree.node.appendChild(ownerDocument.createTextNode(this._stringText));
    }
    lazyTree.node.appendChild(closingComment);
    ReactDOMComponentTree.precacheNode(this, openingComment);
    this._closingComment = closingComment;
    return lazyTree;
}

//冒泡阶段的事件监听；
var EventListener = {
    listen: function (target,eventType,callback) {
        if (target.addEventListener) {
            target.addEventListener(eventType, callback, false);
            return {
                remove: function () {
                    target.removeEventListener(eventType, callback, false);
                }
            }
        }
        else if (target.attchEvent) {
            target.attchEvent('on'+eventType, callback);
            return {
                remove: function () {
                    target.detachEvent('on' + eventType, callback);
                }
            }
        }
    }//,
    //dispatchEvent: function (nativeEvent) {
    //    //ReactUpdates.batchedUpdates(nativeEvent);
    //    var targetInst = getClosestInstanceFromNode(nativeEvent.target);
    //    if (targetInst._hostNode) {
    //        targetInst = targetInst._hostNode;
    //    }
    //}
};


//RESERVED_PROPS为_source, self,key,ref的一个枚举，此方法的作用是让props复制除_source, self,key,ref之外的其它属性；
var RESERVED_PROPS = {
    _source: true,
    self: true,
    key: true,
    ref: true
}
//React API,ReactClass初始化的时候需要赋上方法名；
var ReactClassInterface = {
    mixins: 'DEFINE_MANY',
    statics: 'DEFINE_MANY',
    propTypes: 'DEFINE_MANY',
    contextTypes: 'DEFINE_MANY',
    childContextTypes: 'DEFINE_MANY',
    getDefaultProps: 'DEFINE_MANY_MERGED',
    getInitialState: 'DEFINE_MANY_MERGED',
    getChildContext: 'DEFINE_MANY_MERGED',
    render: 'DEFINE_ONCE',
    componentWillMount: 'DEFINE_MANY',
    componentDidMount: 'DEFINE_MANY',
    componentWillReceiveProps: 'DEFINE_MANY',
    shouldComponentUpdate: 'DEFINE_ONCE',
    componentWillUpdate: 'DEFINE_MANY',
    componentDidUpdate: 'DEFINE_MANY',
    componentWillUnmount: 'DEFINE_MANY',
    updateComponent: 'OVERRIDE_BASE'

};
