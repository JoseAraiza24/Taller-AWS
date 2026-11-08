// Compatibilidad de preflight con Serverless 3 y el API compartido de LocalStack.
class CorsDeployment {
  constructor(serverless) {
    this.serverless = serverless;
    this.hooks = {
      "after:package:compileEvents": () => this.validJsonTemplates(),
      "after:deploy:deploy": () => this.reconcileLocalPreflight(),
    };
  }

  validJsonTemplates() {
    const template = this.serverless.service.provider.compiledCloudFormationTemplate;
    for (const resource of Object.values(template.Resources || {})) {
      const properties = resource.Properties;
      if (resource.Type === "AWS::ApiGateway::Method" && properties.HttpMethod === "OPTIONS" && properties.Integration?.Type === "MOCK") {
        properties.Integration.RequestTemplates = { "application/json": JSON.stringify({ statusCode: 200 }) };
      }
    }
  }

  async reconcileLocalPreflight() {
    const provider = this.serverless.getProvider("aws");
    const stage = provider.getStage();
    if (stage !== "local") return;
    const request = (method, params) => provider.request("APIGateway", method, params);
    const exports = await provider.request("CloudFormation", "listExports", {});
    const apiId = exports.Exports.find(item => item.Name === `MainRestApiId-${stage}`)?.Value;
    if (!apiId) throw new Error("Falta el export del API compartido para este entorno");
    const resources = (await request("getResources", { restApiId: apiId, limit: 500 })).items;
    const paths = new Map();
    for (const fn of Object.values(this.serverless.service.functions)) {
      for (const event of fn.events || []) {
        const http = event.http;
        if (!http || !http.cors) continue;
        const path = `/${http.path.replace(/^\/+|\/+$/g, "")}`;
        if (!paths.has(path)) paths.set(path, new Set(["OPTIONS"]));
        paths.get(path).add(http.method.toUpperCase());
      }
    }
    const origin = this.serverless.service.provider.environment.CORS_ORIGINS.split(",")[0].trim();
    for (const [path, methods] of paths) {
      const resource = resources.find(item => item.path === path);
      if (!resource) throw new Error(`Falta el recurso ${path}`);
      const target = { restApiId: apiId, resourceId: resource.id, httpMethod: "OPTIONS" };
      if (!resource.resourceMethods?.OPTIONS) await request("putMethod", { ...target, authorizationType: "NONE", apiKeyRequired: false });
      await request("putIntegration", { ...target, type: "MOCK", requestTemplates: { "application/json": JSON.stringify({ statusCode: 200 }) }, passthroughBehavior: "WHEN_NO_MATCH", contentHandling: "CONVERT_TO_TEXT" });
      const headers = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Api-Key,X-Amz-Date,X-Amz-Security-Token", "Access-Control-Allow-Methods": [...methods].join(",") };
      await request("putMethodResponse", { ...target, statusCode: "200", responseParameters: Object.fromEntries(Object.keys(headers).map(header => [`method.response.header.${header}`, true])) });
      await request("putIntegrationResponse", { ...target, statusCode: "200", responseParameters: Object.fromEntries(Object.entries(headers).map(([header, value]) => [`method.response.header.${header}`, `'${value}'`])), responseTemplates: { "application/json": "" } });
    }
    await request("createDeployment", { restApiId: apiId, stageName: stage, description: "Actualizar preflight del API compartido" });
  }
}

module.exports = CorsDeployment;
