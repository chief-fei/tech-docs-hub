# Netty 网络应用框架完全指南

## 概述

Netty 是一个异步事件驱动的网络应用框架，用于快速开发高性能、高可靠性的网络服务器和客户端程序。Netty 简化了 TCP/UDP Socket 编程，是 Java 生态中最广泛使用的网络通信框架。

> **兼容性**：Netty 4.1.x 基于 JDK 8+，与 Spring Boot 2.7.x 完全兼容。

---

## 一、依赖配置

### Maven

```xml path=null start=null
<dependency>
    <groupId>io.netty</groupId>
    <artifactId>netty-all</artifactId>
    <version>4.1.125.Final</version>
</dependency>
```

也可以按需引入单独模块：

```xml path=null start=null
<!-- 核心 API -->
<dependency>
    <groupId>io.netty</groupId>
    <artifactId>netty-common</artifactId>
    <version>4.1.125.Final</version>
</dependency>
<!-- Channel 和 Transport -->
<dependency>
    <groupId>io.netty</groupId>
    <artifactId>netty-transport</artifactId>
    <version>4.1.125.Final</version>
</dependency>
<!-- HTTP 编解码 -->
<dependency>
    <groupId>io.netty</groupId>
    <artifactId>netty-codec-http</artifactId>
    <version>4.1.125.Final</version>
</dependency>
<!-- Handler 相关 -->
<dependency>
    <groupId>io.netty</groupId>
    <artifactId>netty-handler</artifactId>
    <version>4.1.125.Final</version>
</dependency>
<!-- 缓冲区 -->
<dependency>
    <groupId>io.netty</groupId>
    <artifactId>netty-buffer</artifactId>
    <version>4.1.125.Final</version>
</dependency>
```

---

## 二、核心概念

### 2.1 架构概览

```text
┌─────────────────────────────────────────┐
│              Netty Application           │
├─────────────────────────────────────────┤
│  ChannelPipeline (Handler 链)            │
│  ┌───────┐  ┌────────┐  ┌──────────┐   │
│  │ 编码器 │→│ 业务Handler │→│ 解码器   │   │
│  └───────┘  └────────┘  └──────────┘   │
├─────────────────────────────────────────┤
│           EventLoop (事件循环)            │
├─────────────────────────────────────────┤
│         Channel (通道) / Socket          │
└─────────────────────────────────────────┘
```

### 2.2 核心组件

| 组件 | 说明 |
|------|------|
| **Channel** | 代表一个 Socket 连接，负责 I/O 操作 |
| **EventLoopGroup** | 事件循环组，管理 Channel 的 I/O 操作 |
| **EventLoop** | 单个事件循环线程，处理注册在其上的 Channel 的所有事件 |
| **ChannelPipeline** | Handler 处理器链，处理入站/出站事件 |
| **ChannelHandler** | 处理器，对数据进行编解码或业务处理 |
| **ByteBuf** | Netty 的数据容器（替代 JDK 的 ByteBuffer） |
| **Bootstrap** | 客户端启动引导类 |
| **ServerBootstrap** | 服务端启动引导类 |
| **ChannelFuture** | 异步 I/O 操作的结果通知 |

### 2.3 EventLoopGroup 线程模型

```text
服务端有两个 EventLoopGroup：

BossGroup (通常 1 个线程)
  └── 负责接受客户端连接

WorkerGroup (通常 CPU 核数 × 2 个线程)
  └── 负责处理已连接 Channel 的读写事件

客户端只需一个 EventLoopGroup：
WorkerGroup → 负责连接和服务端通信
```

---

## 三、快速开始

### 3.1 TCP 服务端

```java path=null start=null
import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.*;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import io.netty.util.CharsetUtil;

public class NettyServer {

    private int port;

    public NettyServer(int port) {
        this.port = port;
    }

    public void start() throws Exception {
        // 1. 创建 Boss 和 Worker EventLoopGroup
        EventLoopGroup bossGroup = new NioEventLoopGroup(1);    // 接受连接
        EventLoopGroup workerGroup = new NioEventLoopGroup();   // 处理读写

        try {
            // 2. 创建 ServerBootstrap
            ServerBootstrap bootstrap = new ServerBootstrap();
            bootstrap.group(bossGroup, workerGroup)
                .channel(NioServerSocketChannel.class)          // NIO 传输
                .childHandler(new ChannelInitializer<SocketChannel>() {
                    @Override
                    protected void initChannel(SocketChannel ch) {
                        // 3. 配置 ChannelPipeline
                        ch.pipeline().addLast(new ServerHandler());
                    }
                })
                .option(ChannelOption.SO_BACKLOG, 128)          // 连接等待队列
                .childOption(ChannelOption.SO_KEEPALIVE, true); // 保持连接

            // 4. 绑定端口，启动服务
            ChannelFuture future = bootstrap.bind(port).sync();
            System.out.println("Server started on port " + port);

            // 5. 阻塞等待服务关闭
            future.channel().closeFuture().sync();
        } finally {
            // 6. 优雅关闭
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }
    }

    // 自定义 Handler：处理收到的数据
    static class ServerHandler extends ChannelInboundHandlerAdapter {

        @Override
        public void channelRead(ChannelHandlerContext ctx, Object msg) {
            ByteBuf in = (ByteBuf) msg;
            String received = in.toString(CharsetUtil.UTF_8);
            System.out.println("Server received: " + received);

            // 回复客户端
            ctx.write(Unpooled.copiedBuffer("Echo: " + received, CharsetUtil.UTF_8));
        }

        @Override
        public void channelReadComplete(ChannelHandlerContext ctx) {
            ctx.flush(); // 将缓冲数据刷出
        }

        @Override
        public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) {
            cause.printStackTrace();
            ctx.close();
        }
    }

    public static void main(String[] args) throws Exception {
        new NettyServer(8080).start();
    }
}
```

### 3.2 TCP 客户端

```java path=null start=null
import io.netty.bootstrap.Bootstrap;
import io.netty.channel.*;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioSocketChannel;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import io.netty.util.CharsetUtil;

public class NettyClient {

    private String host;
    private int port;

    public NettyClient(String host, int port) {
        this.host = host;
        this.port = port;
    }

    public void start() throws Exception {
        EventLoopGroup group = new NioEventLoopGroup();

        try {
            Bootstrap bootstrap = new Bootstrap();
            bootstrap.group(group)
                .channel(NioSocketChannel.class)
                .handler(new ChannelInitializer<SocketChannel>() {
                    @Override
                    protected void initChannel(SocketChannel ch) {
                        ch.pipeline().addLast(new ClientHandler());
                    }
                })
                .option(ChannelOption.TCP_NODELAY, true)
                .option(ChannelOption.SO_KEEPALIVE, true);

            // 连接服务端
            ChannelFuture future = bootstrap.connect(host, port).sync();
            System.out.println("Connected to server " + host + ":" + port);

            // 发送消息
            Channel channel = future.channel();
            channel.writeAndFlush(Unpooled.copiedBuffer("Hello Netty!", CharsetUtil.UTF_8));

            // 等待连接关闭
            channel.closeFuture().sync();
        } finally {
            group.shutdownGracefully();
        }
    }

    static class ClientHandler extends ChannelInboundHandlerAdapter {

        @Override
        public void channelRead(ChannelHandlerContext ctx, Object msg) {
            ByteBuf in = (ByteBuf) msg;
            System.out.println("Client received: " + in.toString(CharsetUtil.UTF_8));
        }

        @Override
        public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) {
            cause.printStackTrace();
            ctx.close();
        }
    }

    public static void main(String[] args) throws Exception {
        new NettyClient("localhost", 8080).start();
    }
}
```

---

## 四、ChannelPipeline 与 Handler

### 4.1 Handler 类型

```text
入站事件（Inbound）：数据从远端 → 本地
  按 addLast() 顺序执行
  ChannelInboundHandler → channelRead → channelReadComplete

出站事件（Outbound）：数据从本地 → 远端
  按 addLast() 逆序执行
  ChannelOutboundHandler → write → flush
```

### 4.2 编解码器

Netty 提供了众多内置编解码器，简化协议处理：

```java path=null start=null
// ======== String 编解码 ========
pipeline.addLast(new StringEncoder());        // 出站：String → ByteBuf
pipeline.addLast(new StringDecoder());        // 入站：ByteBuf → String

// ======== 分隔符解码（基于换行符或自定义分隔符） ========
pipeline.addLast(new DelimiterBasedFrameDecoder(8192, Delimiters.lineDelimiter()));

// ======== 定长解码器 ========
pipeline.addLast(new FixedLengthFrameDecoder(10));

// ======== 行解码器（基于换行符分割） ========
pipeline.addLast(new LineBasedFrameDecoder(1024));

// ======== LengthFieldBased 解码（常用，自定义协议） ========
pipeline.addLast(new LengthFieldBasedFrameDecoder(
    65535,   // maxFrameLength
    0,       // lengthFieldOffset
    2,       // lengthFieldLength
    0,       // lengthAdjustment
    2        // initialBytesToStrip
));

// ======== ObjectEncoder/Decoder（基于 JDK 序列化，不推荐） ========
pipeline.addLast(new ObjectEncoder());
pipeline.addLast(new ObjectDecoder(ClassResolvers.cacheDisabled(null)));
```

### 4.3 自定义编解码器

```java path=null start=null
import io.netty.buffer.ByteBuf;
import io.netty.channel.ChannelHandlerContext;
import io.netty.handler.codec.MessageToByteEncoder;
import io.netty.handler.codec.ByteToMessageDecoder;
import java.util.List;

/**
 * 自定义编码器：将 Message 对象编码为字节
 */
public class MessageEncoder extends MessageToByteEncoder<Message> {

    @Override
    protected void encode(ChannelHandlerContext ctx, Message msg, ByteBuf out) {
        // 写入消息长度（2字节）
        out.writeShort(msg.getLength());
        // 写入消息内容
        out.writeBytes(msg.getContent());
    }
}

/**
 * 自定义解码器：将字节解码为 Message 对象
 */
public class MessageDecoder extends ByteToMessageDecoder {

    @Override
    protected void decode(ChannelHandlerContext ctx, ByteBuf in, List<Object> out) {
        // 等待足够的可读字节（至少2字节长度头）
        if (in.readableBytes() < 2) {
            return;
        }

        // 标记当前读取位置
        in.markReaderIndex();

        // 读取长度
        int length = in.readShort();

        // 等待足够的可读字节（完整消息体）
        if (in.readableBytes() < length) {
            in.resetReaderIndex(); // 回退
            return;
        }

        // 读取消息体
        byte[] content = new byte[length];
        in.readBytes(content);

        out.add(new Message(length, content));
    }
}
```

---

## 五、HTTP 服务端示例

```java path=null start=null
import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.*;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.http.*;
import io.netty.buffer.Unpooled;
import io.netty.util.CharsetUtil;

public class HttpServer {

    private int port;

    public HttpServer(int port) {
        this.port = port;
    }

    public void start() throws Exception {
        EventLoopGroup bossGroup = new NioEventLoopGroup(1);
        EventLoopGroup workerGroup = new NioEventLoopGroup();

        try {
            ServerBootstrap bootstrap = new ServerBootstrap();
            bootstrap.group(bossGroup, workerGroup)
                .channel(NioServerSocketChannel.class)
                .childHandler(new ChannelInitializer<SocketChannel>() {
                    @Override
                    protected void initChannel(SocketChannel ch) {
                        ch.pipeline()
                            // HTTP 编解码
                            .addLast(new HttpServerCodec())
                            // 聚合 HTTP 消息（将分块消息合并为完整消息）
                            .addLast(new HttpObjectAggregator(65536))
                            // 压缩
                            .addLast(new HttpContentCompressor())
                            // 业务 Handler
                            .addLast(new HttpServerHandler());
                    }
                });

            ChannelFuture future = bootstrap.bind(port).sync();
            System.out.println("HTTP Server started on http://localhost:" + port);
            future.channel().closeFuture().sync();
        } finally {
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }
    }

    static class HttpServerHandler extends SimpleChannelInboundHandler<FullHttpRequest> {

        @Override
        protected void channelRead0(ChannelHandlerContext ctx, FullHttpRequest request) {
            String uri = request.uri();
            String responseContent;

            if ("/hello".equals(uri)) {
                responseContent = "{\"message\": \"Hello from Netty HTTP Server!\"}";
            } else {
                responseContent = "{\"message\": \"Welcome to Netty HTTP Server\"}";
            }

            // 构造 HTTP 响应
            FullHttpResponse response = new DefaultFullHttpResponse(
                HttpVersion.HTTP_1_1,
                HttpResponseStatus.OK,
                Unpooled.copiedBuffer(responseContent, CharsetUtil.UTF_8)
            );

            response.headers()
                .set(HttpHeaderNames.CONTENT_TYPE, "application/json; charset=UTF-8")
                .set(HttpHeaderNames.CONTENT_LENGTH, response.content().readableBytes());

            ctx.writeAndFlush(response);
        }

        @Override
        public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) {
            cause.printStackTrace();
            ctx.close();
        }
    }

    public static void main(String[] args) throws Exception {
        new HttpServer(8080).start();
    }
}
```

---

## 六、Spring Boot 2.7.x 集成推荐

Spring Boot 2.7.x 本身内置了 Tomcat/Jetty/Undertow，一般不需要用 Netty 替代 Web 容器。Netty 在 Spring Boot 项目中的典型应用场景：

| 场景 | 说明 |
|------|------|
| **自定义 TCP 服务** | 不经过 HTTP，直接基于 TCP 协议通信 |
| **WebSocket 服务** | 需要低延迟、高并发的实时通信 |
| **协议网关** | 自定义协议的代理/网关服务（如 IoT） |
| **RPC 框架底层** | 作为自定义 RPC 框架的传输层 |

### 与 Spring Boot 集成示例

```java path=null start=null
import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.*;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;

@Component
public class NettyTcpServer {

    @Value("${netty.tcp.port:8888}")
    private int port;

    private EventLoopGroup bossGroup;
    private EventLoopGroup workerGroup;
    private Channel serverChannel;

    @PostConstruct
    public void start() throws InterruptedException {
        bossGroup = new NioEventLoopGroup(1);
        workerGroup = new NioEventLoopGroup();

        ServerBootstrap bootstrap = new ServerBootstrap();
        bootstrap.group(bossGroup, workerGroup)
            .channel(NioServerSocketChannel.class)
            .childHandler(new ChannelInitializer<Channel>() {
                @Override
                protected void initChannel(Channel ch) {
                    // 配置 pipeline
                }
            });

        ChannelFuture future = bootstrap.bind(port).sync();
        serverChannel = future.channel();
        System.out.println("Netty TCP Server started on port " + port);
    }

    @PreDestroy
    public void stop() {
        if (serverChannel != null) {
            serverChannel.close();
        }
        if (bossGroup != null) {
            bossGroup.shutdownGracefully();
        }
        if (workerGroup != null) {
            workerGroup.shutdownGracefully();
        }
    }
}
```

```properties path=null start=null
# application.properties
netty.tcp.port=8888
```

### POM 配置（Spring Boot 2.7.18）

```xml path=null start=null
<project>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>2.7.18</version>
    </parent>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>

        <dependency>
            <groupId>io.netty</groupId>
            <artifactId>netty-all</artifactId>
            <version>4.1.125.Final</version>
        </dependency>

        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
    </dependencies>
</project>
```

---

## 七、ByteBuf 使用指南

`ByteBuf` 是 Netty 的字节容器，相比 JDK 的 `ByteBuffer` 更易用。

```java path=null start=null
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import io.netty.buffer.PooledByteBufAllocator;

// ======== 创建 ByteBuf ========
ByteBuf buf = Unpooled.buffer(1024);           // 非池化（1024字节）
ByteBuf pooled = PooledByteBufAllocator.DEFAULT.buffer(1024); // 池化（推荐）

// ======== 写入数据 ========
buf.writeInt(42);                               // 写入 int（4字节）
buf.writeLong(123456789L);                      // 写入 long（8字节）
buf.writeBytes("hello".getBytes());             // 写入字节数组

// ======== 读取数据 ========
int readInt = buf.readInt();                    // 读 int
long readLong = buf.readLong();                 // 读 long
byte[] readBytes = new byte[5];
buf.readBytes(readBytes);                       // 读字节数组

// ======== 索引管理 ========
buf.markReaderIndex();                          // 标记读索引
buf.resetReaderIndex();                         // 恢复读索引
buf.markWriterIndex();                          // 标记写索引
buf.resetWriterIndex();                         // 恢复写索引

// ======== 其他操作 ========
int readable = buf.readableBytes();             // 可读字节数
boolean hasData = buf.isReadable();             // 是否有可读数据
buf.clear();                                    // 重置读写索引（不真正清空数据）
buf.skipBytes(4);                               // 跳过 4 字节
buf.release();                                  // 释放 bytebuf（池化时必须）
```

---

## 八、常用选项与配置

### Bootstrap 选项

```java path=null start=null
// 服务端选项
bootstrap.option(ChannelOption.SO_BACKLOG, 128);         // 连接队列大小
bootstrap.childOption(ChannelOption.SO_KEEPALIVE, true); // 保持连接
bootstrap.childOption(ChannelOption.TCP_NODELAY, true);  // 禁用 Nagle 算法（低延迟）
bootstrap.childOption(ChannelOption.SO_RCVBUF, 65536);   // 接收缓冲区
bootstrap.childOption(ChannelOption.SO_SNDBUF, 65536);   // 发送缓冲区
```

### 线程数配置

```java path=null start=null
// Boss 线程数：通常 1 个即可
EventLoopGroup bossGroup = new NioEventLoopGroup(1);

// Worker 线程数：建议 CPU 核数 × 2
EventLoopGroup workerGroup = new NioEventLoopGroup(
    Runtime.getRuntime().availableProcessors() * 2
);
```

---

## 九、核心组件速查表

| 组件/类 | 包路径 | 说明 |
|------|------|------|
| **ServerBootstrap** | `io.netty.bootstrap` | 服务端启动引导 |
| **Bootstrap** | `io.netty.bootstrap` | 客户端启动引导 |
| **EventLoopGroup** | `io.netty.channel` | 事件循环组 |
| **NioEventLoopGroup** | `io.netty.channel.nio` | NIO 事件循环组 |
| **Channel** | `io.netty.channel` | 网络通道接口 |
| **NioServerSocketChannel** | `io.netty.channel.socket.nio` | NIO 服务端 Channel |
| **NioSocketChannel** | `io.netty.channel.socket.nio` | NIO 客户端 Channel |
| **ChannelPipeline** | `io.netty.channel` | Handler 处理链 |
| **ChannelInitializer** | `io.netty.channel` | 初始化 Channel 的 Handler |
| **ChannelHandlerContext** | `io.netty.channel` | Handler 上下文 |
| **ChannelInboundHandlerAdapter** | `io.netty.channel` | 入站 Handler 适配器 |
| **ChannelOutboundHandlerAdapter** | `io.netty.channel` | 出站 Handler 适配器 |
| **SimpleChannelInboundHandler** | `io.netty.channel` | 简化的入站 Handler（自动释放 ByteBuf） |
| **ByteBuf** | `io.netty.buffer` | 字节容器 |
| **Unpooled** | `io.netty.buffer` | 非池化 ByteBuf 工具 |
| **ChannelFuture** | `io.netty.channel` | 异步操作结果 |
| **ChannelOption** | `io.netty.channel` | Channel 配置选项 |

### 编解码器速查

| 编解码器 | 包路径 | 说明 |
|------|------|------|
| **StringEncoder** | `io.netty.handler.codec.string` | 字符串编码器 |
| **StringDecoder** | `io.netty.handler.codec.string` | 字符串解码器 |
| **LineBasedFrameDecoder** | `io.netty.handler.codec` | 行分割解码器 |
| **DelimiterBasedFrameDecoder** | `io.netty.handler.codec` | 分隔符解码器 |
| **FixedLengthFrameDecoder** | `io.netty.handler.codec` | 定长帧解码器 |
| **LengthFieldBasedFrameDecoder** | `io.netty.handler.codec` | 基于长度字段的解码器 |
| **HttpServerCodec** | `io.netty.handler.codec.http` | HTTP 服务端编解码 |
| **HttpClientCodec** | `io.netty.handler.codec.http` | HTTP 客户端编解码 |
| **HttpObjectAggregator** | `io.netty.handler.codec.http` | HTTP 消息聚合 |
| **MessageToByteEncoder** | `io.netty.handler.codec` | 自定义编码器基类 |
| **ByteToMessageDecoder** | `io.netty.handler.codec` | 自定义解码器基类 |

---

## 十、常见问题

**Q: Netty 与 Tomcat 有什么区别？**
Tomcat 是 Servlet 容器，专注 HTTP 协议；Netty 是通用网络框架，支持 TCP/UDP/HTTP 等任意协议。Spring Boot 2.7.x 默认使用 Tomcat 处理 HTTP。

**Q: Netty 与 Spring Boot 内置的 WebFlux 有什么关系？**
Spring WebFlux 默认使用 Netty 作为底层引擎（当使用 reactive 方式时）。但如果你使用 `spring-boot-starter-web`（Servlet 模式），底层是 Tomcat，与 Netty 无关。

**Q: NioEventLoopGroup 线程数怎么设置？**
- BossGroup：通常 1 个线程足够
- WorkerGroup：建议 `CPU 核数 × 2`，可通过 `Runtime.getRuntime().availableProcessors()` 获取

**Q: ByteBuf 需要手动释放吗？**
- PooledByteBuf：必须调用 `release()` 释放回池中
- 使用 `SimpleChannelInboundHandler` 可以自动释放

**Q: Netty 4.1.x 与 Spring Boot 2.7.x 兼容吗？**
完全兼容。注意如果项目中同时使用了 `spring-boot-starter-webflux`，需要检查 Netty 版本是否冲突。

---

## 十一、参考资源

- [Netty 官方文档](https://netty.io/wiki/)
- [Netty User Guide for 4.x](https://netty.io/wiki/user-guide-for-4.x.html)
- [Netty GitHub](https://github.com/netty/netty)
- [Netty API 文档](https://netty.io/4.1/api/)
- [Spring Boot 2.7.x 文档](../spring-boot/)