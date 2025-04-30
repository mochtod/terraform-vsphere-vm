# Terraform vSphere VM Project

This project provides a Terraform configuration for creating and managing virtual machines on a vSphere environment using the vSphere provider.

## Project Structure

The project consists of the following files:

- **main.tf**: The main configuration file that defines the resources to be created, including the virtual machine and its properties.
- **variables.tf**: Declares the input variables for the Terraform configuration, specifying types and descriptions.
- **outputs.tf**: Defines the output values that Terraform will return after applying the configuration.
- **providers.tf**: Specifies the provider configuration for Terraform, including the vSphere provider and its connection details.
- **terraform.tfvars.example**: An example file that provides a template for users to set their variable values.
- **modules/vm/main.tf**: Contains the configuration for the virtual machine module, defining resources and settings specific to the VM.
- **modules/vm/variables.tf**: Declares input variables specific to the virtual machine module for customization.
- **modules/vm/outputs.tf**: Defines output values for the virtual machine module, providing information about the created VM.

## Getting Started

To get started with this project, follow these steps:

1. **Install Terraform**: Ensure that you have Terraform installed on your machine. You can download it from the [Terraform website](https://www.terraform.io/downloads.html).

2. **Set Up vSphere Provider**: Update the `providers.tf` file with your vSphere connection details.

3. **Configure Variables**: Copy `terraform.tfvars.example` to `terraform.tfvars` and update the variable values as needed.

4. **Initialize Terraform**: Run the following command to initialize the Terraform configuration:
   ```
   terraform init
   ```

5. **Plan the Deployment**: Use the following command to see what resources will be created:
   ```
   terraform plan
   ```

6. **Apply the Configuration**: To create the virtual machine, run:
   ```
   terraform apply
   ```

7. **View Outputs**: After the apply completes, you can view the output values defined in `outputs.tf`.

## Modules

This project uses a modular approach for the virtual machine configuration. The `modules/vm` directory contains all the necessary files to manage the VM as a separate module.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.