# Docker 使用指南

Docker 是开源容器化平台，用于打包、分发和运行应用。

## 文档目录

| 文档 | 说明 |
|------|------|
| [镜像管理命令](./image.md) | pull、build、tag、push、save、load、rmi |
| [容器管理命令](./container.md) | run、start、stop、exec、logs、inspect 参数详解 |
| [Dockerfile 编写指南](./dockerfile.md) | 全部指令详解、多阶段构建、最佳实践 |
| [Docker Compose](./compose.md) | 多容器编排、服务定义、网络与数据卷 |
| [Spring Boot 容器化](./spring-boot.md) | 项目容器化实战、Dockerfile 模板 |

## 核心概念

| 概念 | 说明 | 类比 |
|------|------|------|
| **镜像（Image）** | 应用的只读模板 | 类（Class） |
| **容器（Container）** | 镜像的运行实例 | 对象（Object） |
| **仓库（Registry）** | 存储和分发镜像 | Maven 仓库 |
| **Dockerfile** | 构建镜像的指令文件 | pom.xml |

## 快速安装

```bash
# macOS
brew install --cask docker

# Linux
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER

# 验证
docker --version
docker run hello-world
```
