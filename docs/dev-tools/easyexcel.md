# EasyExcel 3.3.x 完全指南

## 概述

EasyExcel 是阿里巴巴开源的高性能 Excel 处理框架，基于流式读写，极大降低了内存占用。相比 Apache POI，EasyExcel 在百万级数据量下仍能保持极低内存消耗。

> **兼容性**：EasyExcel 3.3.x 基于 JDK 8+，与 Spring Boot 2.7.x 完全兼容。

### 核心优势

| 对比维度 | EasyExcel | Apache POI |
|---------|-----------|-----------|
| 读写方式 | 流式读写（逐行处理） | 全量加载到内存 |
| 100万行内存占用 | ~10MB | ~2GB（OOM 风险） |
| API 复杂度 | 简单，注解驱动 | 复杂，代码量大 |
| 模板填充 | 原生支持 | 需自行实现 |
| Web 导出 | 原生支持 | 需自行封装 |

---

## 一、快速开始

### 1.1 Maven 依赖

```xml
<dependency>
    <groupId>com.alibaba</groupId>
    <artifactId>easyexcel</artifactId>
    <version>3.3.4</version>
</dependency>
```

> EasyExcel 内置了 `poi` 和 `poi-ooxml`，无需手动添加 Apache POI 依赖。

### 1.2 最简单的写入

```java
// 数据类
@Data
public class UserExcelVO {
    @ExcelProperty("用户名")
    private String username;

    @ExcelProperty("年龄")
    private Integer age;

    @ExcelProperty("邮箱")
    private String email;
}
```

```java
// 写入
List<UserExcelVO> dataList = getUserList();
String fileName = "users.xlsx";
EasyExcel.write(fileName, UserExcelVO.class)
    .sheet("用户列表")
    .doWrite(dataList);
```

### 1.3 最简单的读取

```java
// 同步读取（小数据量）
List<UserExcelVO> list = EasyExcel.read(fileName)
    .head(UserExcelVO.class)
    .sheet()
    .doReadSync();
```

---

## 二、写入 Excel

### 2.1 简单写入

```java
EasyExcel.write(fileName, UserExcelVO.class)
    .sheet("用户列表")        // 设置 Sheet 名称
    .doWrite(dataList);       // 写入数据
```

### 2.2 复杂表头

```java
@Data
public class ComplexHeaderVO {
    @ExcelProperty({"主标题", "用户名"})
    private String username;

    @ExcelProperty({"主标题", "年龄"})
    private Integer age;

    @ExcelProperty({"主标题", "联系方式", "邮箱"})
    private String email;

    @ExcelProperty({"主标题", "联系方式", "手机号"})
    private String phone;
}
```

生成表头：

```
|        主标题              |
| 用户名 | 年龄 |   联系方式    |
|       |      | 邮箱 | 手机号 |
```

### 2.3 列宽与格式

```java
@Data
@HeadRowHeight(30)              // 表头行高
@ContentRowHeight(20)           // 内容行高
@ColumnWidth(20)                // 全局列宽
public class UserExcelVO {

    @ExcelProperty("用户名")
    @ColumnWidth(15)            // 单独设置列宽
    private String username;

    @ExcelProperty("年龄")
    private Integer age;

    @ContentStyle(dataFormat = 49)  // 文本格式，防止科学计数法
    @ExcelProperty("手机号")
    private String phone;

    @DateTimeFormat("yyyy-MM-dd HH:mm:ss")
    @ExcelProperty("创建时间")
    private Date createTime;

    @NumberFormat("#,##0.00")
    @ExcelProperty("金额")
    private BigDecimal amount;
}
```

### 2.4 合并单元格

```java
// 方式一：注解方式
@Data
@HeadRowHeight(30)
public class MergeVO {
    @ExcelProperty("序号")
    private Integer index;

    @ExcelProperty("姓名")
    @ContentLoopMerge(eachRow = 2)   // 每2行合并
    private String name;

    @ExcelProperty("部门")
    private String department;
}

// 方式二：自定义合并策略
EasyExcel.write(fileName, MergeVO.class)
    .registerWriteHandler(new MyMergeStrategy())
    .sheet()
    .doWrite(dataList);
```

### 2.5 自定义样式

```java
// 自定义表头样式
WriteCellStyle headStyle = new WriteCellStyle();
headStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
headStyle.setFillPatternType(FillPatternType.SOLID_FOREGROUND);
headStyle.setHorizontalAlignment(HorizontalAlignment.CENTER);

// 自定义内容样式
WriteCellStyle contentStyle = new WriteCellStyle();
contentStyle.setHorizontalAlignment(HorizontalAlignment.CENTER);
contentStyle.setVerticalAlignment(VerticalAlignment.CENTER);

// 组合
HorizontalCellStyleStrategy styleStrategy = new HorizontalCellStyleStrategy(headStyle, contentStyle);

EasyExcel.write(fileName, UserExcelVO.class)
    .registerWriteHandler(styleStrategy)
    .sheet()
    .doWrite(dataList);
```

---

## 三、模板填充

### 3.1 模板准备

在 `src/main/resources/templates/` 下创建 Excel 模板，使用 `{}` 作为占位符：

| 姓名 | 年龄 | 邮箱 |
|------|------|------|
| {name} | {age} | {email} |

对于列表数据，使用 `{.}` 语法：

| 序号 | 姓名 | 年龄 |
|------|------|------|
| {.index} | {.name} | {.age} |

### 3.2 简单填充（单值替换）

```java
// 模板文件
String templatePath = "templates/user_template.xlsx";

// 填充数据
Map<String, Object> data = new HashMap<>();
data.put("name", "张三");
data.put("age", 25);
data.put("email", "zhangsan@example.com");

EasyExcel.write(fileName)
    .withTemplate(templatePath)
    .sheet()
    .doFill(data);
```

### 3.3 列表填充

```java
List<UserExcelVO> list = getUserList();

// 方式一：Map 填充
EasyExcel.write(fileName)
    .withTemplate(templatePath)
    .sheet()
    .doFill(data);

// 方式二：水平填充（多列表）
FillConfig fillConfig = FillConfig.builder()
    .direction(WriteDirectionEnum.HORIZONTAL)  // 水平填充
    .build();

EasyExcel.write(fileName)
    .withTemplate(templatePath)
    .sheet()
    .doFill(list, fillConfig);
```

### 3.4 组合填充

```java
// 先填充列表，再填充单值
ExcelWriter excelWriter = EasyExcel.write(fileName)
    .withTemplate(templatePath)
    .build();

WriteSheet writeSheet = EasyExcel.writerSheet().build();

// 先填充列表
FillConfig fillConfig = FillConfig.builder().forceNewRow(true).build();
excelWriter.fill(list, fillConfig, writeSheet);

// 再填充单值
Map<String, Object> map = new HashMap<>();
map.put("total", list.size());
map.put("date", DateUtil.today());
excelWriter.fill(map, writeSheet);

excelWriter.finish();
```

---

## 四、读取 Excel

### 4.1 ReadListener（推荐：流式读取）

```java
// 定义监听器
@Slf4j
public class UserDataListener extends AnalysisEventListener<UserExcelVO> {

    private final List<UserExcelVO> cachedList = new ArrayList<>();
    private final UserService userService;

    public UserDataListener(UserService userService) {
        this.userService = userService;
    }

    /**
     * 每解析一行，调用一次
     */
    @Override
    public void invoke(UserExcelVO data, AnalysisContext context) {
        cachedList.add(data);
        // 达到批量阈值，批量保存
        if (cachedList.size() >= 1000) {
            userService.batchSave(cachedList);
            cachedList.clear();
        }
    }

    /**
     * 所有数据解析完成后调用
     */
    @Override
    public void doAfterAllAnalysed(AnalysisContext context) {
        // 保存剩余数据
        if (!cachedList.isEmpty()) {
            userService.batchSave(cachedList);
        }
        log.info("所有数据解析完成！共 {} 条", context.readRowHolder().getRowIndex());
    }
}
```

```java
// 使用
EasyExcel.read(fileName, UserExcelVO.class, new UserDataListener(userService))
    .sheet()
    .doRead();
```

### 4.2 分页读取

```java
// 每次只读取一页数据
EasyExcel.read(fileName, UserExcelVO.class, new ReadListener<UserExcelVO>() {
    @Override
    public void invoke(UserExcelVO data, AnalysisContext context) {
        // 处理单行数据
        log.info("读取到：{}", data);
    }

    @Override
    public void doAfterAllAnalysed(AnalysisContext context) {
        log.info("读取完成");
    }
})
.sheet()
.doRead();
```

### 4.3 同步读取（小数据量）

```java
// 同步读取全部数据到内存
List<UserExcelVO> list = EasyExcel.read(fileName)
    .head(UserExcelVO.class)
    .sheet()
    .doReadSync();
```

::: warning 同步读取注意
`doReadSync()` 会将所有数据加载到内存，**仅适用于小数据量**（<1万行）。大数据量请使用 `ReadListener`。
:::

### 4.4 读取多个 Sheet

```java
ExcelReader reader = EasyExcel.read(fileName).build();

// 读取第一个 Sheet
ReadSheet sheet1 = EasyExcel.readSheet(0)
    .head(UserExcelVO.class)
    .registerReadListener(listener1)
    .build();

// 读取第二个 Sheet
ReadSheet sheet2 = EasyExcel.readSheet(1)
    .head(OrderExcelVO.class)
    .registerReadListener(listener2)
    .build();

// 执行
reader.read(sheet1, sheet2);
reader.finish();
```

---

## 五、数据转换

### 5.1 @ExcelProperty

```java
@ExcelProperty(value = "用户名", index = 0)    // 指定列索引
private String username;

@ExcelProperty(value = "年龄", index = 1)
private Integer age;

@ExcelProperty(value = "状态", converter = StatusConverter.class)  // 自定义转换器
private Integer status;
```

### 5.2 @DateTimeFormat

```java
@DateTimeFormat("yyyy-MM-dd HH:mm:ss")
@ExcelProperty("创建时间")
private Date createTime;

@DateTimeFormat("yyyy-MM-dd")
@ExcelProperty("出生日期")
private Date birthday;
```

### 5.3 @NumberFormat

```java
@NumberFormat("#,##0.00")
@ExcelProperty("金额")
private BigDecimal amount;

@NumberFormat("0.00%")
@ExcelProperty("百分比")
private Double rate;
```

### 5.4 自定义转换器

```java
// 性别转换：写入时 1→男，读取时 男→1
public class GenderConverter implements Converter<Integer> {

    @Override
    public Class<?> supportJavaTypeKey() {
        return Integer.class;
    }

    @Override
    public CellDataTypeEnum supportExcelTypeKey() {
        return CellDataTypeEnum.STRING;
    }

    @Override
    public Integer convertToJavaData(ReadConverterContext<?> context) {
        // 读取 Excel → Java
        String value = context.getReadCellData().getStringValue();
        if ("男".equals(value)) return 1;
        if ("女".equals(value)) return 0;
        return null;
    }

    @Override
    public WriteCellData<?> convertToExcelData(WriteConverterContext<Integer> context) {
        // Java → 写入 Excel
        Integer value = context.getValue();
        if (value == null) return null;
        return new WriteCellData<>(value == 1 ? "男" : "女");
    }
}
```

```java
// 使用
@ExcelProperty(value = "性别", converter = GenderConverter.class)
private Integer gender;
```

---

## 六、下拉列表

### 6.1 简单下拉

```java
// 为指定列添加下拉选项
EasyExcel.write(fileName, UserExcelVO.class)
    .registerWriteHandler(new SheetWriteHandler() {
        @Override
        public void afterSheetCreate(WriteWorkbookHolder wbHolder, WriteSheetHolder sh) {
            DataValidationHelper helper = sh.getSheet().getDataValidationHelper();
            DataValidationConstraint constraint = helper.createExplicitListConstraint(
                new String[]{"男", "女"}
            );
            CellRangeAddressList addressList = new CellRangeAddressList(1, 65535, 2, 2);
            DataValidation validation = helper.createValidation(constraint, addressList);
            sh.getSheet().addValidationData(validation);
        }
    })
    .sheet()
    .doWrite(dataList);
```

### 6.2 级联下拉

级联下拉需要将选项数据写入隐藏 Sheet，然后通过 INDIRECT 公式引用：

```java
EasyExcel.write(fileName)
    .sheet("主数据")
    .registerWriteHandler(new SheetWriteHandler() {
        @Override
        public void afterSheetCreate(WriteWorkbookHolder wbHolder, WriteSheetHolder sh) {
            // 省区名称管理器
            Name name = wbHolder.getWorkbook().getName();
            name.setNameName("province");
            name.setRefersToFormula("隐藏Sheet!$A$1:$A$5");
            // ... 详细级联逻辑
        }
    })
    .doWrite(dataList);
```

---

## 七、Web 集成

### 7.1 文件下载

```java
@RestController
@RequestMapping("/api/excel")
@RequiredArgsConstructor
public class ExcelController {

    private final UserService userService;

    @GetMapping("/download/users")
    public void downloadUsers(HttpServletResponse response) throws IOException {
        // 设置响应头
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setCharacterEncoding("UTF-8");
        String fileName = URLEncoder.encode("用户列表", "UTF-8").replaceAll("\\+", "%20");
        response.setHeader("Content-Disposition", "attachment;filename*=UTF-8''" + fileName + ".xlsx");

        // 查询数据
        List<UserExcelVO> dataList = userService.getExportList();

        // 写入响应流
        EasyExcel.write(response.getOutputStream(), UserExcelVO.class)
            .sheet("用户列表")
            .doWrite(dataList);
    }

    @PostMapping("/download/template")
    public void downloadTemplate(HttpServletResponse response) throws IOException {
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setCharacterEncoding("UTF-8");
        String fileName = URLEncoder.encode("用户导入模板", "UTF-8").replaceAll("\\+", "%20");
        response.setHeader("Content-Disposition", "attachment;filename*=UTF-8''" + fileName + ".xlsx");

        EasyExcel.write(response.getOutputStream(), UserExcelVO.class)
            .sheet("模板")
            .doWrite(Collections.emptyList());
    }
}
```

### 7.2 文件上传

```java
@PostMapping("/upload/users")
public Result<String> uploadUsers(@RequestParam("file") MultipartFile file) throws IOException {
    if (file.isEmpty()) {
        return Result.error("文件不能为空");
    }

    UserDataListener listener = new UserDataListener(userService);

    EasyExcel.read(file.getInputStream(), UserExcelVO.class, listener)
        .sheet()
        .doRead();

    return Result.success("导入成功");
}
```

### 7.3 上传 + 校验

```java
@Slf4j
public class ValidatingUserListener extends AnalysisEventListener<UserExcelVO> {

    private final List<UserExcelVO> validList = new ArrayList<>();
    private final List<String> errorList = new ArrayList<>();

    @Override
    public void invoke(UserExcelVO data, AnalysisContext context) {
        // 自定义校验
        StringBuilder errors = new StringBuilder();
        if (StrUtil.isBlank(data.getUsername())) {
            errors.append("用户名不能为空；");
        }
        if (data.getAge() == null || data.getAge() < 0 || data.getAge() > 150) {
            errors.append("年龄不合法；");
        }

        if (errors.length() > 0) {
            errorList.add("第" + context.readRowHolder().getRowIndex() + "行：" + errors);
        } else {
            validList.add(data);
        }
    }

    @Override
    public void doAfterAllAnalysed(AnalysisContext context) {
        log.info("有效数据：{} 条，错误数据：{} 条", validList.size(), errorList.size());
    }

    public List<String> getErrors() { return errorList; }
    public List<UserExcelVO> getValidList() { return validList; }
}
```

---

## 八、Spring Boot 2.7.x 完整集成示例

```java
@RestController
@RequestMapping("/api/excel")
@RequiredArgsConstructor
@Slf4j
public class ExcelController {

    private final UserService userService;

    /**
     * 导出 Excel
     */
    @GetMapping("/export")
    public void export(HttpServletResponse response) throws IOException {
        setExcelResponse(response, "用户列表");
        List<UserExcelVO> list = userService.getExportList();
        EasyExcel.write(response.getOutputStream(), UserExcelVO.class)
            .sheet("用户列表")
            .doWrite(list);
    }

    /**
     * 导入 Excel（含校验）
     */
    @PostMapping("/import")
    public Result<Map<String, Object>> importExcel(@RequestParam("file") MultipartFile file) {
        try {
            ValidatingUserListener listener = new ValidatingUserListener();
            EasyExcel.read(file.getInputStream(), UserExcelVO.class, listener)
                .sheet()
                .doRead();

            // 保存有效数据
            if (!listener.getValidList().isEmpty()) {
                userService.batchSave(listener.getValidList());
            }

            Map<String, Object> result = new HashMap<>();
            result.put("successCount", listener.getValidList().size());
            result.put("errorCount", listener.getErrors().size());
            result.put("errors", listener.getErrors());
            return Result.success(result);
        } catch (Exception e) {
            log.error("导入失败", e);
            return Result.error("导入失败：" + e.getMessage());
        }
    }

    /**
     * 下载导入模板
     */
    @GetMapping("/template")
    public void downloadTemplate(HttpServletResponse response) throws IOException {
        setExcelResponse(response, "用户导入模板");
        EasyExcel.write(response.getOutputStream(), UserExcelVO.class)
            .sheet("模板")
            .doWrite(Collections.emptyList());
    }

    private void setExcelResponse(HttpServletResponse response, String fileName) throws IOException {
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setCharacterEncoding("UTF-8");
        String encodedName = URLEncoder.encode(fileName, "UTF-8").replaceAll("\\+", "%20");
        response.setHeader("Content-Disposition", "attachment;filename*=UTF-8''" + encodedName + ".xlsx");
    }
}
```

---

## 九、常见问题

**Q: 读取 Excel 时 OOM 怎么办？**

务必使用 `ReadListener` 流式读取，不要使用 `doReadSync()`。在 `invoke()` 方法中批量处理数据，不要全部缓存。

**Q: 手机号/身份证号变成科学计数法？**

添加 `@ContentStyle(dataFormat = 49)`（文本格式）或使用 `@ExcelProperty` 时指定 `converter` 为字符串转换器。

**Q: 日期格式不对？**

使用 `@DateTimeFormat("yyyy-MM-dd HH:mm:ss")` 注解指定格式。

**Q: 表头占多行，读取时跳过？**

```java
EasyExcel.read(fileName, UserExcelVO.class, listener)
    .headRowNumber(2)   // 表头行数
    .sheet()
    .doRead();
```

**Q: 模板填充后公式不计算？**

写入后需要用户在 Excel 中手动计算公式，或使用 `Workbook.write()` 后调用 `wb.setForceFormulaRecalculation(true)`。

**Q: 如何写入多个 Sheet？**

```java
ExcelWriter writer = EasyExcel.write(fileName).build();
writer.write(userList, EasyExcel.writerSheet("用户").head(UserExcelVO.class).build());
writer.write(orderList, EasyExcel.writerSheet("订单").head(OrderExcelVO.class).build());
writer.finish();
```

---

## 参考资源

- [EasyExcel 官方文档](https://easyexcel.opensource.alibaba.com/)
- [EasyExcel GitHub](https://github.com/alibaba/easyexcel)
- [Spring Boot 2.7.x 文档](../spring-boot/)