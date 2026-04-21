I would like to automate the extraction of vulnerablities from Checkmarx SAST on premise (not checkmarx ONE) using an adequate scripting langauage.
use "swagger 9.6.json" for api call endpoints
1) the script must be executable from CLI and Pipeline.
2) the script must offer human readable execution logs.
3) authentication is done using username/password and described in this blog: https://docs.checkmarx.com/en/34965-278101-using-the-cxsast--rest--api--v8-6-0-and-up-.html 

obtain token needs a post request to: 
endpoint "/cxrestapi/auth/identity/connect/token" 
grant_type: 'password'
scope: 'sast_rest_api'
client_id: 'resource_owner_client'
client_secret: '014DF517-39D1-4453-B7B3-9930C563627C'

which returns a bearer token.

4) must have a request retry mechanism with retries if any endpoint fails
5) script's main output is a csv file "vulnerability_extract.csv" containing all the vulnerabilities detected on all projects, each row is a vulnerablity. the columns are as follow:
"Entity,ITPM ID,Business App Name,Checkmarx project name,CX Project ID, DORA Criticallity,PCI DSS Relevance,Internet Facing,AGO SME,Technical Contact,LSO,RSO,Query,QueryPath,Custom,PCI DSS v3.2.1,OWASP TOP 10 2013,FISMA 2014,NIST SP 800-53,OWASP Top 10 2017,OWASP Mobile Top 10 2016,OWASP Top 10 API,ASD STIG 4.10,OWASP Top 10 2010,CWE top 25,MOIS(KISA) Secure Coding 2021,OWASP ASVS,OWASP Top 10 2021,SANS top 25,ASA Mobile Premium,ASA Premium,Top Tier,ASD STIG 5.3,Base Preset,OWASP Top 10 API 2023,PCI DSS v4.0,SrcFileName,Line,Column,NodeId,Name,DestFileName,DestLine,DestColumn,DestNodeId,DestName,Result State,Result Severity,Assigned To,Comment,Link,Result Status,Detection Date"
Origin:
The following columns are on a per-project and can be found in a stored excel file: Entity,ITPM ID,Business App Name,Checkmarx project name,CX Project ID, DORA Criticallity,PCI DSS Relevance,Internet Facing,AGO SME,Technical Contact,LSO,RSO
The rest of the columns are returned from the endpoint /CxRestApi/sast/scans/{scan_id}/results

#Main:
1) Obtain token
2) build projects_info dictionary from the excel file
3) enrich projects_info with last_scan_id using CX API
4) build the vulnerability_extract_{timestamp}.csv the remaining columns using /CxRestApi/sast/scans/{last_scan_id}/results for each project