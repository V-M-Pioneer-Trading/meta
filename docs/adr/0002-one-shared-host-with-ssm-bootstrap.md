# One shared EC2 host, deployed by SSM bootstrap documents

Every backend runs as a Docker container on one EC2 host; each service's Terraform stack owns an SSM document whose bootstrap script (re)starts its containers, and CI redeploys by running that document. This was chosen over ECS/EKS for cost and simplicity. The price: one host is a single point of failure, a changed document restarts its containers (databases included), and an apply races a CI deploy running the same document.

Source: V-M-Pioneer-Trading/infrastructure `README.md#Deployment model`
