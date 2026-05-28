# COLA 命名规范

COLA 框架推荐一套标准的命名约定，帮助团队保持代码一致性。

## 类名后缀规范

| 层级 | 后缀 | 含义 | 示例 |
|------|------|------|------|
| Domain | `*A` | Aggregate（聚合根） | `OrderA`, `AuthA` |
| Domain | `*E` | Entity（实体） | `UserE`, `LoginLogE` |
| Domain | `*V` | Value Object（值对象） | `UserV`, `CaptchaV` |
| Client | `*CO` | Client Object（客户端对象/DTO） | `UserCO`, `LoginLogCO` |
| Infrastructure | `*DO` | Data Object（数据库对象） | `UserDO`, `OrderDO` |
| App | `*CmdExe` | Command Executor（命令执行器） | `UserCreateCmdExe` |
| App | `*QryExe` | Query Executor（查询执行器） | `UserListQryExe` |
| Domain | `*Gateway` | 网关接口（仓储） | `UserGateway` |
| Infrastructure | `*GatewayImpl` | 网关实现 | `UserGatewayImpl` |
| — | `*Convertor` | 转换器 | `UserConvertor` |
| — | `*Event` | 领域事件 | `LoginEvent` |

## 完整示例

以下是一个用户创建场景的完整命名示例：

```text
请求流程                       类名
─────────────────────────────────────────────────────
HTTP POST /user              → UserController
  ↓
Command 对象                 → UserCreateCmd (implements Command)
  ↓
Client 接口                  → UserServiceI
  ↓
应用服务实现                  → UserServiceImpl
  ↓
命令执行器                    → UserCreateCmdExe
  ↓
领域实体                      → UserE (@Entity)
  ↓
网关接口                      → UserGateway (interface)
  ↓
网关实现 + 数据对象            → UserGatewayImpl (+ UserDO)
  ↓
响应                          → Response / SingleResponse<UserCO>
```

## Command vs Query 命名

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| **Command**（写操作） | `{实体}{动作}Cmd` | `UserCreateCmd`, `OrderCancelCmd` |
| **Query**（读操作） | `{实体}{条件}Qry` | `UserListByNameQry`, `OrderPageQry` |
| **Command 执行器** | `{实体}{动作}CmdExe` | `UserCreateCmdExe` |
| **Query 执行器** | `{实体}{条件}QryExe` | `UserListByNameQryExe` |

## DTO 命名

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 客户端对象 | `{实体}CO` | `UserCO`, `OrderCO` |
| 数据对象 | `{实体}DO` | `UserDO`, `OrderDO` |
| 通用 DTO | `{实体}DTO` | `UserDTO`, `OrderDTO` |
| 领域事件 | `{实体}{动作}Event` | `LoginEvent`, `OrderPaidEvent` |

## Gateway（网关/仓储）命名

```java
// 接口定义在 domain 层
public interface UserGateway {
    UserE getById(String userId);
    void save(UserE user);
}

// 实现在 infrastructure 层
@Component
public class UserGatewayImpl implements UserGateway {
    @Autowired
    private UserMapper userMapper;

    public UserE getById(String userId) {
        UserDO userDO = userMapper.selectById(userId);
        return UserConvertor.toEntity(userDO);  // DO → Entity
    }
}
```

## 包名规范

```text
com.example.demo
├── client              # 对外接口 + DTO
│   ├── api             # 服务接口（*ServiceI）
│   ├── dto             # Command, Query, DTO
│   └── dto.event       # 领域事件
├── adapter             # 适配层
│   └── web             # REST Controller
├── app                 # 应用层
│   └── {业务域}
│       ├── executor    # 命令执行器
│       └── executor.query  # 查询执行器
├── domain              # 领域层
│   └── {业务域}
│       ├── gateway     # 网关接口
│       └── domainservice  # 领域服务
└── infrastructure       # 基础设施层
    └── {业务域}
        └── mapper      # MyBatis Mapper
```

## 注意事项

1. **CO 和 DTO 的区别**：CO（Client Object）是 COLA 推荐的客户端展示对象命名，DTO 是更通用的说法，两者可以混用
2. **GateWay 而非 Repository**：COLA 使用 Gateway 命名，体现"防腐层"思想，比 Repository 语义更丰富
3. **执行器粒度**：每个用例一个执行器（`*CmdExe` / `*QryExe`），保持单一职责
4. **Convertor 不可或缺**：必须在 infrastructure 层完成 `DO ↔ Entity ↔ DTO` 的转换，不要让数据库对象泄漏到领域层
