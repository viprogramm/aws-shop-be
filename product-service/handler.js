const AWS = require("aws-sdk");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const scanTable = async (tableName) => {
  const command = new ScanCommand({
    TableName: tableName,
  });

  const response = await docClient.send(command);
  return response.Items;
};

const findItem = async (tableName, fieldName, value) => {
  const command = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: `${fieldName} = :id`,
    ExpressionAttributeValues: {
      ":id": value,
    },
    ConsistentRead: true,
  });

  const response = await docClient.send(command);
  return response.Items;
};

const addItem = async (data) => {
  const id = uuidv4();
  const addProductCommand = new PutCommand({
    TableName: process.env.TABLE_NAME_PRODUCTS,
    Item: { id, ...data },
  });
  const addStockCommand = new PutCommand({
    TableName: process.env.TABLE_NAME_STOCKS,
    Item: { product_id: id, count: 0 },
  });

  const responseProduct = await docClient.send(addProductCommand);
  const responseStock = await docClient.send(addStockCommand);
  return { responseProduct, responseStock };
};

const mergeItem = (product, stock) => {
  return { ...product, count: stock ? stock.count : 0 };
};

const mergeItems = (products, stocks) => {
  const stocksMap = stocks.reduce((acc, stock) => {
    acc[stock.product_id] = stock.count;
    return acc;
  }, {});
  return products.map((p) => mergeItem(p, stocksMap[p.id]));
};

module.exports = {
  getProductsById: async (event) => {
    const {
      pathParameters: { productId },
    } = event;

    const productResult = await findItem(
      process.env.TABLE_NAME_PRODUCTS,
      "id",
      productId
    );
    const product = productResult.length > 0 ? productResult[0] : {};
    const stockResult = await findItem(
      process.env.TABLE_NAME_STOCKS,
      "product_id",
      productId
    );
    const stock = stockResult.length > 0 ? stockResult[0] : {};

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(mergeItem(product, stock)),
    };
  },

  getProductsList: async (event) => {
    const products = await scanTable(process.env.TABLE_NAME_PRODUCTS);
    const stocks = await scanTable(process.env.TABLE_NAME_STOCKS);
    const productsWithStocks = mergeItems(products, stocks);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(productsWithStocks),
    };
  },

  addProduct: async (event) => {
    try {
      const { title, description, price } = JSON.parse(event.body);

      if (!title || !description || !price) {
        throw Error("Fields: title, description, price are required");
      }

      await addItem({ title, description, price });

      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: "Product was added",
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify(err, ["message", "arguments", "type", "name"]),
      };
    }
  },

  catalogBatchProcess: async (event) => {
    try {
      const sns = new AWS.SNS({ region: "eu-west-1" });
      const products = event.Records.map(async ({ body }) => {
        const parsedBody = JSON.parse(body);
        const { title, description, price } = parsedBody;
        console.log("@PRODUCT: ", title, description, price);

        if (
          title === undefined ||
          description === undefined ||
          price === undefined
        ) {
          throw Error("@NO values", title, description, price);
        }
        const product = await addItem({
          title,
          description,
          price: Number(price),
        });
        console.log("SAVED PRODUCT", product);
        return product;
      });
      const productData = await Promise.all(products);
      console.log("@@@PRODUCTS", productData);
      const params = {
        Subject: "Products was created",
        Message: "Created products: " + JSON.stringify(productData),
        TopicArn: process.env.SNS_ARN,
      };
      const data = await sns.publish(params).promise();
      console.log("Message sent:", data.MessageId);
    } catch (err) {
      console.error("@SEROROR ", err);
    }
  },
};
