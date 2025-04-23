---
layout: distill
title: Do Conservative PINNs Train Faster In High Dimensions?
description: Alternatively, how strong is a conservative vector field as an inductive bias? 
tags: code math artificial-intelligence
giscus_comments: true
date: 2025-04-23
featured: true
mermaid:
  enabled: true
  zoomable: true
code_diff: true
map: true
chart:
  chartjs: true
  echarts: true
  vega_lite: true
tikzjax: true
typograms: true

authors:
  - name: Raymond Fan
    #url: "https://en.wikipedia.org/wiki/Albert_Einstein"
    affiliations:
      name: University of Toronto

bibliography: 2018-12-22-distill.bib

toc:
  - name: Introduction
  - name: Experiment and Hypothesis
  - name: Results
  - name: Discussion
  - name: Closing Thoughts

# Below is an example of injecting additional post-specific styles.
# If you use this post as a template, delete this _styles block.
_styles: >
  .fake-img {
    background: #bbb;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 0px 4px rgba(0, 0, 0, 0.1);
    margin-bottom: 12px;
  }
  .fake-img p {
    font-family: monospace;
    color: white;
    text-align: left;
    margin: 12px 0;
    text-align: center;
    font-size: 16px;
  }
---

The code and experimental results for this post are available on [github.](https://github.com/rfangit/conservative_pinn_speed_test/){:target="_blank"}

## Introduction

Physics-Informed Neural Networks (PINNs) incorporate physical laws into their architecture, loss functions, or training process to better model physical systems. A prominent example is [**Hamiltonian Neural Networks**](https://arxiv.org/pdf/1906.01563v1){:target="_blank"}, which uses system coordinates $(x_1, x_2, ..., x_n)$ to predict a scalar $U(x_1, ..., x_n)$. Automatic differentiation then computes gradients $\left(\frac{dU}{dx_1}, ..., \frac{dU}{dx_n}\right)$, which are used for physics applications.

This guarantees predictions (based on the gradients) will obey fundamental physical laws. For Hamiltonian systems, the equations enforce **energy conservation**. In contrast, a neural network trained to directly predict the gradients from data will not necessarily conserve energy, resulting in poor accuracy in predicting the evolution of physical systems.

The trade-off is that such networks are only applicable with systems with known physical laws, which is not a problem in physics applications.

The underlying principles here are not new. It is well known that different neural network architectures are better suited to specific problems, the most prominent being the large advantages of convolutional neural networks in computer vision, due to the presence of translational invariance in these networks. A conservative vector field like the ones trained by Hamiltonian networks also have their own invariants, where any closed line integral over the vector field is 0 - a more abstract and seemingly less powerful condition than translational invariance.

### Training Speed

The improved accuracy of Hamiltonian Neural Networks in physics prediction is well known. What about training speed?

Intuitively, learning one scalar function $U$ seems easier than learning $d$ separate gradient components. Yet the original Hamiltonian NN paper found **negligible differences** in training and test loss compared to baseline networks.

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid 
            loading="eager" 
            path="assets/img/blog_2/train_test_losses.png" 
            class="img-fluid rounded z-depth-1"
            width="80%"
        %}
    </div>
</div>
<div class="caption">
    <strong>Figure:</strong> Train and test losses, as well as energy conservation results from the original Hamiltonian Neural Network paper. Train and test losses between the baseline and the Hamiltonian network are similar except for the real pendulum and two-body problem. In the real pendulum, energy is not conserved so the conditions for a Hamiltonian are not satisfied. The two-body problem has a larger dimension than the other toy problems studied here ($d = 8$ with four spatial coordinates for the two bodies, and four velocity components, whereas the others only have 2 dimensions), which may explain the difference in it's performance.
</div>

However, their experiments focused on mainly *low-dimensional* systems, where the conservative constraint is least restrictive. As an extreme example, any 1D function could be written as $dU/dx$ for some $U$, rendering the advantage of such a formulation moot. In theory, high dimensional systems should display clearer advantages.

In this blog post, we test whether higher dimensions reveal clearer advantages in training speed through various toy conservative vector field problems.

## Experiment Design

Our question is as follows: Does a network with the inductive bias of a conservative vector field built in train faster than a baseline network as dimensionality increases?
### The Toy Problem

We construct a $d$-dimensional problem with inputs being coordinates $\vec{x} = (x_1, ..., x_d)$ in $[-1,1]^d$, and a target output vector field $f(\vec{x})$ derived from a sum of Gaussians:

$$
f(\vec{x}) = \sum_{i=1}^N -a_N \exp\left(-\frac{||\vec{x} - \vec{c}_N||^2}{\sigma_N^2}\right) (\vec{x} - \vec{c}_N)
$$

Here $\vec{c}_N$ are randomly located Gaussian centers with amplitudes and widths $a_N, \sigma_N$. This vector field is conservative, since $f(\vec{x})$ is the gradient of a scalar sum of Gaussians.

### Network Architectures

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid 
            loading="eager" 
            path="assets/img/blog_2/neural_network.png" 
            class="img-fluid rounded z-depth-1"
            width="80%"
        %}
    </div>
</div>
<div class="caption">
    <strong>Figure:</strong> A baseline network takes in $\vec{x}$ and outputs a $d$-dimensional vector directly as a prediction. Our conservative network instead predicts a scalar $U$, and it's predictions are obtained from taking the gradient of $U$, pictured above.
</div>

We compare two approaches:
- **Baseline Network:**  
   Directly predicts all $d$ output components $(y_1, ..., y_d)$.

- **Conservative Network:**  
   Predicts a scalar potential $U(\vec{x})$, with gradients $\left(\frac{dU}{dx_1}, ..., \frac{dU}{dx_n}\right) = \vec{y}$ computed via automatic differentiation.

Both use identical hidden-layer architectures, differing only in input/output dimensions. We analyze how their training and test losses behave as we scale the dimension of the problem.

### Scaling with Dimension

#### Fixed Parameters

- **Network Size**: Hidden layers are fixed; Input and output(baseline network only) layers grow with $d$.

- **Test and Training Points**: Fixed at $t_{test}, t_{train} = 10^4$. This reflects real-life high-dimensional problems, where training and test data is limited and does not grow with dimension.

- **Gaussian Amplitudes**: All amplitudes are equal, fixed at 1.

- **Gaussian Variances**: Variances are chosen uniformly from $[0.5, 1.0]$. This spread was chosen to make sure the different centers have different variances, and the variances are not so large as to cover all of space, nor so small as to make dense coverage of the space impossible without an exorbitant amount of points.

#### Three Experimental Regimes

We test three approaches for the scaling underlying vector field with dimension, determined solely by the number of Gaussian centers.

**Constant Density**: As the dimension increases, the number of Gaussian points increase accordingly, related to the following scaling law

$$
N \propto \frac{V_{\text{cube}}}{\langle V_{\text{Gaussian}} \rangle} = \frac{2^d}{\langle \sigma^d \rangle} \cdot \frac{\Gamma\left(\frac{d}{2} + 1\right)}{\pi^{d/2}}
$$

which approximately ensures each Gaussian *can* have 1 $\sigma$ of space around itself without overlaps. Note that due to random center generation, they will not end up evenly spread.

**Fixed N = 15**: As the dimension increases, the number of Gaussian points stays fixed at $N = 15$. This number was chosen arbitrarily.

**Fixed N = 2**: The number of Gaussian points stays fixed at $N = 2$. This was chosen to be simpler than the previous case, to observe how the problem difficulty affects the results.

These three regimes span a wide variety of cases, from a problem whose complexity scales with dimension to a simple problem defined by the location of two points in $d$-dimensional space, and their corresponding variances.

## Hypothesis

The conservative constraint should become more useful in high dimensions, since the baseline network must learn d independent functions, but the conservative network learns just one scalar potential.

Therefore the conservative network should have lower train and test losses per epoch than the baseline network as the dimension of the problem is increased, regardless of the experimental regime. 

## Results

We tested networks across a variety of dimensions for the three experiments. For each dimension, three architectures were used:

| Network Configuration | Hidden Layers       |
|-----------------------|---------------------|
| Small                 | [64, 64, 64]        |
| Medium                | [128, 128, 128]     |
| Large                 | [256, 256, 256]     |

Each architecture was trained with **10 different weight initializations** each on **10 different randomly generated datasets** to ensure reported results are not artifacts of peculiar initializations. All data (Gaussian parameters as well as training and test points) were generated with fixed random seeds for reproducibility.

The test and training loss behaved almost identically for all architectures and datasets. All reported results occured regardless of weight initializations or dataset generation.

### Dense Gaussians

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid 
            loading="eager" 
            path="assets/img/blog_2/dense_256_losses.png" 
            class="img-fluid rounded z-depth-1"
            width="80%"
        %}
    </div>
</div>
<div class="caption">
    <strong>Figure:</strong> Test and train losses for a network with hidden layers of $[256, 256, 256]$ neurons on our toy problem with densely packed Gaussians in $d = 2, 5, 8, 12$. Differences in losses gradually appear as the dimension increases. Shaded regions represent $\pm 1$ standard deviation among the 10 different weight initializations.
</div>

In the dense case, little differences were observed between losses at $d < 8$. At $d \geq 8$, there were notable decreases in the train/test loss for conservative networks. These trends occured in all network architectures, with the most significant effects for smaller networks. 

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid 
            loading="eager" 
            path="assets/img/blog_2/dense_64_losses.png" 
            class="img-fluid rounded z-depth-1"
            width="80%"
        %}
    </div>
</div>
<div class="caption">
    <strong>Figure:</strong> Test and train losses for a network with hidden layers of $[64, 64, 64]$ neurons on our toy problem with densely packed Gaussians in $d = 2, 5, 8, 12$. Differences in losses gradually appear as the dimension increases. The effect of conservative networks is notably larger in this smaller network. Shaded regions represent $\pm 1$ standard deviation among the 10 different weight initializations.
</div>

### N = 15 Gaussians
<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid 
            loading="eager" 
            path="assets/img/blog_2/sparse_losses.png" 
            class="img-fluid rounded z-depth-1"
            width="80%"
        %}
    </div>
</div>
<div class="caption">
    <strong>Figure:</strong> Test and train losses for a network with hidden layers of $[64, 64, 64]$ and $[256, 256, 256]$ neurons on our toy problem with $N = 15$ Gaussians in $d = 5, 12, 20$. Slight differences in losses in higher dimensions, with benefits from conservative networks notably larger in smaller networks. Shaded regions represent $\pm 1$ standard deviation among the 10 different weight initializations.
</div>

For fixed center number $N = 15$, there was little difference between between losses at small dimension, and notably smaller loss at higher dimensions. For fixed center number it is easy to increase the dimension of the problem, so we test up to $d = 20$. Smaller networks enjoy greater advantages from the conservative bias. 

Note the advantages of a conservative network are much smaller for the fixed center number than in the dense case.

### N = 2 Gaussians
<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid 
            loading="eager" 
            path="assets/img/blog_2/n=2_losses.png" 
            class="img-fluid rounded z-depth-1"
            width="80%"
        %}
    </div>
</div>
<div class="caption">
    <strong>Figure:</strong> Test and train losses for a network with hidden layers of $[64, 64, 64]$ and $[256, 256, 256]$ neurons on our toy problem with $N = 2$ Gaussians in $d = 5, 12, 20$. Slight differences in losses in higher dimensions, with benefits from conservative networks notably larger in smaller networks. Shaded regions represent $\pm 1$ standard deviation among the 10 different weight initializations.
</div>

For $N= 2$ Gaussians, the loss again only notably decreases at high dimensions, with effects more severe in smaller networks.

### Control Experiment: Non-Conservative Field
To verify results arise from our conservative inductive bias, we test our networks on a non-conservative field. This field was achieved by multiplying our conservative vector field outputs by a fixed matrix of constant coefficients.

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid 
            loading="eager" 
            path="assets/img/blog_2/nonconservative_losses.png" 
            class="img-fluid rounded z-depth-1"
            width="80%"
        %}
    </div>
</div>
<div class="caption">
    <strong>Figure:</strong> Test and train losses for baseline and conservative neural networks when the underlying problem is not a conservative vector field. The vector field was generated via a linear transformation on the original conservative vector field, which is known to be enough to break conservativity. The conservative neural network does noticeably worse in all cases.
</div>

The performance of conservative networks degraded significantly here. showing that our observed improvements in training speed occur because our conservative networks are well-suited to predicting conservative vector fields.

More data for other dimensions, other initializations of datasets and the intermediate architecture size can be found on the github repo.

## Discussion

Hamiltonian networks contain inductive biases inspired from physics, and their advantages in accuracy are well known.

This work instead examined whether networks with a built-in conservation law (like Hamiltonian NNs) improved training speed. The results showed these networks have smaller training and test loss for a given epoch when the dimension of the problem is very high. This is consistent with results from the original, where the only system to show improvements in training and test loss was the two body problem, which has 8 system coordinates (4 spatial coordinates and 4 velocity coordinates). However, the reduction in loss was fairly minor, with baseline networks almost always achieving lower loss when given x3 the number of epochs.

This aligns with the theoretical expectation that learning a scalar potential should be simpler than a $d$ diemsnional vector field. Unfortunately, there is no evidence of a general scaling law for the training speedup of a conservative network, as the speedup effects are dependent on the architecture and do not appear to generalize. See example figures on the ratio of test losses in the github repo.

In this comparison I've neglected the additional compute time cost of the conservative network. The conservative network generates a scalar, and automatic differentiation is needed for gradients. Automatic differentiation is also used in computing the loss, and constitutes a significant amount of time in training networks.

In our experiments, this makes our conservative networks take roughly twice as long per epoch. Plotting the compute time vs training loss instead of the epoch, we find very minor gains in training performance assuming they do not disappear entirely.

<div class="row mt-3">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid 
            loading="eager" 
            path="assets/img/blog_2/compute_time.png" 
            class="img-fluid rounded z-depth-1"
            width="80%"
        %}
    </div>
</div>
<div class="caption">
    <strong>Figure:</strong> Taking into account the automatic differentiation needed to evaluate conservative networks roughly doubles the time per epoch, we compare conservative networks with the baseline. There are some slight advantages even in the larger networks, but the increased computational cost removes most advantages in training speed.
</div>

**Note:** It's not clear to me that this slowdown is fundamental and can't be sped up with some clever gradient accumulation, so this problem may be fixable.

These findings suggest the gains by a conservative architecture in speeding up training speeds is relatively modest, especially when training large networks. The advantages are larger for smaller networks.

## Closing Thoughts

There are two reasons I started looking into this.

The first reason was pretty academic: Inductive biases like translational invariance are very powerful in neural networks, such as CNNs, and these biases show great advantages in training speed. A conservative vector field seems like a weaker inductive bias, but it's not clear how much weaker it is. How much weaker is one of the questions I set out to answer here.

The second reason is that lots of problems can be mapped to conservative vector fields. Therefore if there was a significant speedup, it would make sense to map problems to a conservative vector field and learn there.

An example of personal interest to me is the flow-matching objective, used in a lot of generative modelling. For MSEloss, the analytic solution for the velocities from flow-matching is given by

$$
v(\vec{x}, t) = \vec{x} C_0 (t) + C_1 (t) \times \left( \vec{x} - \sum_{i} P_{softmax}(C_2(\vec{x} - C_3 (t) \vec{u}_i )^2)  \vec{u}_i \right)
$$

where $C_0, C_1, C_2, C_3$ are time-dependent functions that depend on the scheduling used in training (eg, most flow-matching purposes use a linear schedule), and $\vec{u}_i$ are vectors that represent our actual data used to train the model. The terms in front are pretty simple, and the machine learning magic occurs in estimating

$$
\sum_{i} P_{softmax}(C_2(\vec{x} - C_3 (t) \vec{u}_i )^2)  \vec{u}_i
$$

which moves directly towards data points, weighted by the softmax of the distance squared. This term is magic, because as the number of training samples gets large enough, our models seem to stop giving the analytic answer above and instead learn some approximate field that lets them generate new images! I think it's a very interesting topic.

Recalling that softmax is given by

$$
P(x) = \frac{e^{-x}}{\sum_x e^{-x}}
$$

and ignoring the denominator assuming it's large or doesn't change much, the machine learning part of this problem looks a lot like a conservative vector field of the form

$$
\frac{d U}{d \vec{x}} = e^{-\vec{x}^2} \times \vec{x}
$$

which seems related to [some recent work on treating the flow from flow-matching as approximately curl-free.](https://arxiv.org/pdf/1906.01563v1){:target="_blank"}

Sadly the assumption there (ignoring the denominator) doesn't seem to work well(?), and the speedup isn't really significant enough to be more useful. More on this view of flow-matching in a later blog post.

If you found the contents of this blog post useful, or have any questions, please feel free to leave a comment!